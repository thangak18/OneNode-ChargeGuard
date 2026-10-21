'use client';
import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { pendingReadCount, READ_ACTIVITY_EVENT } from '@/lib/api';

export function BackendReadNotice() {
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const update=()=>{
      if(pendingReadCount()>0) {
        timer ??= setTimeout(()=>setVisible(true),4000);
      } else {clearTimeout(timer);timer=undefined;setVisible(false);}
    };
    const initial=setTimeout(update,0);
    window.addEventListener(READ_ACTIVITY_EVENT,update);
    return ()=>{clearTimeout(initial);clearTimeout(timer);window.removeEventListener(READ_ACTIVITY_EVENT,update);};
  },[]);
  if(!visible)return null;
  return <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 border-b border-cyan-900 bg-slate-900 px-4 py-3 text-sm text-cyan-200"><LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/><span>Waiting for backend data. The Free service may be waking up; this can take about a minute. Displayed timestamps remain unchanged.</span></div>;
}
