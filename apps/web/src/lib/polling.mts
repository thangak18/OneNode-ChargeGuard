/** Serial, view-driven reads only. A slow request cannot accumulate interval calls. */
export function startSerialPolling(load:()=>void|Promise<unknown>, intervalMs:number, shouldRun:()=>boolean=()=>true, onStop:()=>void=()=>{}):()=>void {
  let stopped=false;
  let timer:ReturnType<typeof setTimeout>;
  const run=async()=>{
    try {if(!stopped && shouldRun())await load();}
    catch { /* Callers own their error UI; keep a rejected read from becoming unhandled. */ }
    finally {if(!stopped)timer=setTimeout(()=>void run(),intervalMs);}
  };
  timer=setTimeout(()=>void run(),0);
  return ()=>{stopped=true;clearTimeout(timer);onStop();};
}
