import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import { assertTestDatabase, createTestDb } from "../support/database";
import { createTestOwner } from "../support/test-owner";
import { mutate, practice, act, library, editorExercise } from "@/lib/learning/repository";
import { SAMPLE_CONTENT } from "@/lib/learning/content";
const db=createTestDb(); const owners:string[]=[];
beforeAll(async()=>{await assertTestDatabase(db);owners.push(await createTestOwner(db),await createTestOwner(db));});
afterAll(async()=>{await assertTestDatabase(db);await db.user.deleteMany({where:{id:{in:owners}}});await db.$disconnect();});
async function fixture() {
  const material=await mutate(db,owners[0],{kind:"material",title:randomUUID()});
  const chapter=await mutate(db,owners[0],{kind:"chapter",materialId:material.id,title:"Mate in One",order:0});
  const exercise=await mutate(db,owners[0],{kind:"exercise",chapterId:chapter.id,number:"1",title:"Pin",order:0,content:SAMPLE_CONTENT});
  await mutate(db,owners[0],{kind:"validate",id:exercise.id,expectedRevision:0});
  await mutate(db,owners[0],{kind:"publish",id:exercise.id,expectedRevision:1});
  const puzzle=(await practice(db,owners[0],exercise.id))!;
  return {materialId:material.id,chapterId:chapter.id,id:exercise.id,revisionId:puzzle.learning.revisionId};
}
const action=(revision:number, move?:string)=>move?{action:"MOVE" as const,move,requestId:randomUUID(),expectedRevision:revision}:{action:"HINT" as const,requestId:randomUUID(),expectedRevision:revision};
it("conceals answers, persists completion, and isolates direct reads/writes",async()=>{
  const f=await fixture();
  expect(await practice(db,owners[0],f.id)).toMatchObject({solution:null,solutionLine:null,learning:{publishedSolution:null,explanation:null}});
  expect(await practice(db,owners[1],f.id)).toBeNull(); expect(await editorExercise(db,owners[1],f.id)).toBeNull();
  expect(await act(db,owners[1],f.id,f.revisionId,action(0,"a1a6"))).toEqual({status:"NOT_FOUND"});
  expect(await mutate(db,owners[1],{kind:"validate",id:f.id,expectedRevision:2}).catch(e=>e.status)).toBe(404);
  const solved=await act(db,owners[0],f.id,f.revisionId,action(0,"a1a6"));
  expect(solved).toMatchObject({status:"OK",puzzle:{learning:{publishedSolution:"Rxa6#"},progress:{state:"SOLVED",completionAssisted:false}}});
  expect(await practice(db,owners[0],f.id)).toMatchObject({progress:{state:"SOLVED"}});
});
it("deduplicates simultaneous requests and serializes stale tabs",async()=>{
  const f=await fixture(); const input=action(0,"a1a6");
  const results=await Promise.all([act(db,owners[0],f.id,f.revisionId,input),act(db,owners[0],f.id,f.revisionId,input)]);
  expect(results.map(r=>r.status)).toEqual(["OK","OK"]);
  expect(await db.learningAttempt.count({where:{progress:{revisionId:f.revisionId}}})).toBe(1);
  expect(await act(db,owners[0],f.id,f.revisionId,{...input,action:"MOVE",move:"a1a2"})).toHaveProperty("status","CONFLICT");
  expect(await act(db,owners[0],f.id,f.revisionId,action(0))).toHaveProperty("status","CONFLICT");
});
it("preserves assistance and first completion across reveal/retry and lost-response delivery",async()=>{
  const f=await fixture();await act(db,owners[0],f.id,f.revisionId,action(0));
  await act(db,owners[0],f.id,f.revisionId,{action:"REVEAL",requestId:randomUUID(),expectedRevision:1});
  expect(await practice(db,owners[0],f.id)).toMatchObject({progress:{completedAt:null,assisted:true}});
  const retry={action:"RETRY" as const,requestId:randomUUID(),expectedRevision:2};
  await act(db,owners[0],f.id,f.revisionId,retry);await act(db,owners[0],f.id,f.revisionId,action(3,"a1a6"));
  const completed=(await practice(db,owners[0],f.id))!.progress.completedAt;
  expect(await act(db,owners[0],f.id,f.revisionId,retry)).toMatchObject({status:"OK",puzzle:{progress:{completedAt:completed,state:"SOLVED",completionAssisted:true}}});
});
it("pins attempts to immutable answer revisions and preserves presentation-only completion",async()=>{
  const f=await fixture();await act(db,owners[0],f.id,f.revisionId,action(0));
  await mutate(db,owners[0],{kind:"exercise",id:f.id,chapterId:f.chapterId,number:"1",title:"Renamed",order:9,expectedRevision:2,content:{...SAMPLE_CONTENT,diagramPage:"7"}});
  await mutate(db,owners[0],{kind:"publish",id:f.id,expectedRevision:3});
  expect((await practice(db,owners[0],f.id))!.learning.revisionId).toBe(f.revisionId);
  await mutate(db,owners[0],{kind:"exercise",id:f.id,chapterId:f.chapterId,number:"1",title:"Renamed",order:9,expectedRevision:4,content:{...SAMPLE_CONTENT,hint:"Use the rook"}});
  expect(await mutate(db,owners[0],{kind:"publish",id:f.id,expectedRevision:5}).catch(e=>e.message)).toContain("Validate");
  await mutate(db,owners[0],{kind:"validate",id:f.id,expectedRevision:5});await mutate(db,owners[0],{kind:"publish",id:f.id,expectedRevision:6});
  const current=(await practice(db,owners[0],f.id))!;expect(current.learning.revisionId).not.toBe(f.revisionId);expect(current.progress.assisted).toBe(false);
  expect(await act(db,owners[0],f.id,f.revisionId,action(1,"a1a6"))).toMatchObject({status:"OK",puzzle:{progress:{state:"SOLVED",completionAssisted:true}}});
  expect((await practice(db,owners[0],f.id))!.progress.completedAt).toBeNull();
  expect(await db.learningRevision.count({where:{exerciseId:f.id}})).toBe(2);
});
it("excludes drafts/archives from playable totals and retains history",async()=>{
  const f=await fixture();await act(db,owners[0],f.id,f.revisionId,action(0,"a1a6"));
  const draft=await mutate(db,owners[0],{kind:"exercise",chapterId:f.chapterId,number:"2",title:"Incomplete",order:1,content:{...SAMPLE_CONTENT,type:"MISSING_PIECE",fen:""}});
  expect(await practice(db,owners[0],draft.id)).toBeNull();
  const before=(await library(db,owners[0])).find(m=>m.id===f.materialId)!;
  expect(before.chapters[0].exercises.filter(e=>e.published)).toHaveLength(1);
  await mutate(db,owners[0],{kind:"exercise",id:f.id,chapterId:f.chapterId,number:"1",title:"Pin",order:0,archived:true,expectedRevision:2,content:SAMPLE_CONTENT});
  expect(await practice(db,owners[0],f.id)).toBeNull();expect(await db.learningProgress.count({where:{revisionId:f.revisionId,completedAt:{not:null}}})).toBe(1);
});
it("supports shared read-only content with private progress and hides unpublished exercises",async()=>{
  const f=await fixture();await mutate(db,owners[0],{kind:"exercise",chapterId:f.chapterId,number:"2",title:"Secret draft",order:2,content:SAMPLE_CONTENT});
  await db.learningMaterial.update({where:{id:f.materialId},data:{shared:true}});
  expect(await practice(db,owners[1],f.id)).not.toBeNull();
  expect(await editorExercise(db,owners[0],f.id)).toBeNull();
  expect(await mutate(db,owners[1],{kind:"material",id:f.materialId,title:"Hijack",expectedRevision:0}).catch(e=>e.status)).toBe(404);
  expect((await library(db,owners[1])).find(m=>m.id===f.materialId)!.chapters[0].exercises).toHaveLength(1);
  await act(db,owners[1],f.id,f.revisionId,action(0,"a1a6"));
  expect((await practice(db,owners[0],f.id))!.progress.completedAt).toBeNull();
});
it("rejects stale authoring, duplicate numbers, and unowned PDF links",async()=>{
  const f=await fixture();
  expect(await mutate(db,owners[0],{kind:"exercise",id:f.id,chapterId:f.chapterId,number:"1",title:"Pin",order:0,expectedRevision:0,content:SAMPLE_CONTENT}).catch(e=>e.status)).toBe(409);
  expect(await mutate(db,owners[0],{kind:"exercise",chapterId:f.chapterId,number:"1",title:"Duplicate",order:0,content:SAMPLE_CONTENT}).catch(e=>e.code)).toBe("P2002");
  expect(await mutate(db,owners[0],{kind:"exercise",chapterId:f.chapterId,number:"2",title:"PDF",order:0,content:{...SAMPLE_CONTENT,pdfId:"someone-elses-book"}}).catch(e=>e.message)).toContain("owned");
});
it("creates the supplied sample only in the explicit owning account and deduplicates delivery",async()=>{
  const results=await Promise.all([mutate(db,owners[1],{kind:"sample"}),mutate(db,owners[1],{kind:"sample"})]);
  expect(results[0].id).toBe(results[1].id);
  const material=(await library(db,owners[1])).find(m=>m.id===results[0].id)!;
  expect(material.shared).toBe(false);expect(material.chapters[0].exercises[0].published).not.toBeNull();
  expect((await library(db,owners[0])).some(m=>m.id===results[0].id)).toBe(false);
});
