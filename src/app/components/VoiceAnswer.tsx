'use client';

import { useEffect, useRef, useState } from 'react';

export function VoiceAnswer({ disabled, request, onUse }: { disabled: boolean; request: typeof fetch; onUse: (text: string) => boolean }) {
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'recording' | 'transcribing'>('idle');
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const busy = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    request('/api/asr').then((r) => r.json()).then((b) => { if (mounted.current) setConfigured(Boolean(b.ok && b.data.configured)); }).catch(() => undefined);
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      controller.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [request]);
  async function start() {
    if (busy.current || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMessage('浏览器不支持录音，请使用 HTTPS 或本机地址，也可直接输入文字。'); return; }
    busy.current = true;
    setStatus('starting'); setMessage(''); setTranscript('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type));
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = instance;
      const chunks: Blob[] = [];
      let size = 0;
      let recordingFailed = false;
      instance.onerror = () => {
        recordingFailed = true;
        clearTimeout(timer.current);
        media.getTracks().forEach((track) => track.stop());
        if (instance.state !== 'inactive') instance.stop();
        busy.current = false;
        if (mounted.current) { setMessage('录音设备异常，请重新录制或使用文字输入。'); setStatus('idle'); }
      };
      instance.ondataavailable = (event) => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 10 * 1024 * 1024 && instance.state === 'recording') instance.stop(); } };
      instance.onstop = async () => {
        clearTimeout(timer.current);
        media.getTracks().forEach((track) => track.stop());
        if (!mounted.current || recordingFailed) return;
        if (!size || size > 10 * 1024 * 1024) { setMessage('录音为空或超过 10 MB，请重新录制。'); busy.current = false; setStatus('idle'); return; }
        setStatus('transcribing');
        controller.current = new AbortController();
        try {
          const type = instance.mimeType || mimeType || 'audio/webm';
          const form = new FormData();
          form.append('file', new Blob(chunks, { type }), `answer.${type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'}`);
          const response = await request('/api/asr', { method: 'POST', body: form, signal: controller.current.signal });
          const body = await response.json();
          if (!mounted.current) return;
          if (body.ok) { setTranscript(body.data.text); setMessage('请核对转写，再追加到回答；不会自动提交。'); }
          else setMessage(body.message ?? '转写失败，请使用文字输入或重新录制。');
        } catch { if (mounted.current) setMessage('转写失败，请使用文字输入或重新录制。'); }
        finally { busy.current = false; if (mounted.current) setStatus('idle'); }
      };
      instance.start(1000); setStatus('recording');
      timer.current = setTimeout(() => { if (instance.state === 'recording') instance.stop(); }, 120_000);
    } catch { busy.current = false; stream.current?.getTracks().forEach((track) => track.stop()); if (mounted.current) { setMessage('无法开启麦克风，请检查权限和设备，或继续文字输入。'); setStatus('idle'); } }
  }
  return <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
    <p>语音输入：最长 2 分钟。停止后音频将发送至已配置的转写服务，本应用不保存录音。</p>
    {!configured ? <p>语音服务未启用，请使用文字输入。</p> : <button type="button" disabled={disabled || status === 'starting' || status === 'transcribing'} onClick={() => status === 'recording' ? recorder.current?.stop() : void start()} className="cf-button-secondary px-3 py-2 disabled:opacity-50">{status === 'recording' ? '停止并转写' : status === 'transcribing' ? '转写中…' : status === 'starting' ? '等待麦克风权限…' : '开始录音'}</button>}
    {message ? <p role="status">{message}</p> : null}
    {transcript ? <><label className="block">转写预览<textarea className="cf-input mt-1 w-full p-2" rows={4} maxLength={5000} value={transcript} onChange={(event) => setTranscript(event.target.value)} /></label><button type="button" disabled={disabled} onClick={() => { if (onUse(transcript)) setTranscript(''); }} className="underline">追加到当前回答</button></> : null}
  </div>;
}
