"use client";
import { useState } from "react";
import type { OpeningDto } from "@/lib/openings/repository";
import styles from "./openings.module.css";
export function OpeningVideos({ opening }: { opening: OpeningDto }) {
  const [videos, setVideos] = useState(opening.videos);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inputKey, setInputKey] = useState(0);
  async function upload() {
    if (!file) { setError("Choose an MP4 video first."); return; }
    if (file.size > 100 * 1024 * 1024) { setError("Videos must be 100 MB or smaller."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/openings/${opening.id}/videos?name=${encodeURIComponent(name.trim() || file.name)}`, { method: "POST", headers: { "Content-Type": "video/mp4" }, body: file });
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Upload failed.");
      setVideos(data.opening.videos); setFile(null); setName(""); setInputKey(inputKey + 1); setNotice("Video uploaded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed. Try again."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/openings/${opening.id}/videos/${id}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Could not remove the video.");
      setVideos(data.opening.videos); setNotice("Video removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove the video."); }
    finally { setBusy(false); }
  }
  return <section className={styles.card}>
    <h2>Opening videos</h2><p className={styles.muted}>Private MP4 videos, up to 100 MB each. Playback depends on your browser’s support for the video’s codecs.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.status}>{notice}</p>}
    {videos.map(video => <div className={styles.line} key={video.id}><h3>{video.name}</h3><p className={styles.muted}>{(video.size / 1024 / 1024).toFixed(1)} MB</p><video className={styles.video} controls preload="metadata" aria-label={video.name} src={`/api/openings/${opening.id}/videos/${video.id}`} onError={() => setError(`Could not play “${video.name}”. Check your session, video storage, and browser codec support.`)} /><button disabled={busy} className={styles.button} onClick={() => remove(video.id)}>Remove {video.name}</button></div>)}
    {!videos.length && <p className={styles.status}>No videos uploaded yet.</p>}
    <form onSubmit={event => { event.preventDefault(); void upload(); }}>
      <label className={styles.field}>Video title<input value={name} maxLength={200} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <label className={styles.field}>MP4 file<input key={inputKey} type="file" accept="video/mp4,.mp4" disabled={busy} onChange={event => setFile(event.target.files?.[0] || null)} /></label>
      <button className={styles.primary} disabled={busy || !file}>{busy ? "Uploading / saving…" : "Upload video"}</button>
    </form>
  </section>;
}
