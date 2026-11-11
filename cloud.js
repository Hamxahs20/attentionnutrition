(function(){
 const cfg=window.ATTENTION_CLOUD_CONFIG||{};
 const enabled=Boolean(cfg.url&&cfg.anonKey&&window.supabase);
 const client=enabled?window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
 const status=()=>document.getElementById('cloud-status');
 const say=s=>{if(status())status().textContent=s};
 let user=null;
 const authReady=client?client.auth.getUser().then(({data,error})=>{user=error?null:data.user;return user}).catch(()=>null):Promise.resolve(null);
 async function getUser(){await authReady;if(!client)return null;const {data}=await client.auth.getUser();user=data.user;return user}
 async function login(email){if(!client)throw Error('Configure config.js first');
   const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
   if(error)throw error;return true;
 }
 async function logout(){if(client)await client.auth.signOut();user=null;location.reload()}
 async function push(rows){const u=await getUser();if(!u||!rows.length)return false;
   const clean=rows.filter(x=>x&&x.id&&['protein','fiber','carbs','water','fast'].includes(x.category)).map(x=>({
     id:String(x.id),user_id:u.id,source:x.source||'manual',started_at:x.startedAt||new Date((x.day||'2026-01-01')+'T'+String(x.hour||0).padStart(2,'0')+':00:00').toISOString(),
     category:x.category,watched_ms:Math.max(0,Math.round(Number(x.watchedMs??(x.minutes||0)*60000))),note:String(x.note||'').slice(0,120)
   }));
   if(!clean.length)return false;
   const {error}=await client.from('attention_events').upsert(clean,{onConflict:'user_id,id'});
   if(error){say('Sync error: '+error.message);return false}say('Cloud synced ✓');return true;
 }
 async function pull(){const u=await getUser();if(!u)return null;
   const {data,error}=await client.from('attention_events').select('id,source,started_at,category,watched_ms,note').order('started_at',{ascending:false}).limit(2000);
   if(error){say('Sync error: '+error.message);return null}
   say('Cloud synced ✓');return (data||[]).map(x=>{const d=new Date(x.started_at);return {id:x.id,day:localDay(d),hour:d.getHours(),category:x.category,minutes:Math.round(x.watched_ms/6000)/10,note:x.note||'',source:x.source}});
 }
 function localDay(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
 async function remove(ids){const u=await getUser();if(!u||!ids.length)return;const {error}=await client.from('attention_events').delete().in('id',ids);if(error)say('Delete error: '+error.message)}
 function mount(){const bar=document.createElement('div');bar.style.cssText='position:fixed;z-index:9999;bottom:12px;right:12px;background:#fff;color:#244536;border:1px solid #cbd8cf;box-shadow:0 8px 30px #0002;padding:9px 12px;border-radius:13px;font:12px system-ui;max-width:260px;';
   bar.innerHTML='<div id="cloud-status">Checking sync…</div><div id="cloud-actions" style="margin-top:5px"></div>';document.body.append(bar);
   const actions=document.getElementById('cloud-actions');
   if(!enabled){say('Local only · Set up config.js for cloud sync');return}
   getUser().then(u=>{if(u){say('Signed in · '+u.email);const b=document.createElement('button');b.textContent='Sign out';b.onclick=logout;actions.append(b)}else{say('Cloud ready · Sign in to sync');const a=document.createElement('a');a.href='connect.html?next='+encodeURIComponent(location.pathname.split('/').pop());a.textContent='Connect account ↗';actions.append(a)}});
 }
 window.AttentionCloud={enabled,client,getUser,login,logout,push,pull,remove,mount};
 document.addEventListener('DOMContentLoaded',mount);
})();