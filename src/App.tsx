import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Anchor, Gauge, Navigation, Play, Plus, ShipWheel, Clock3, Route, Settings, CircleDot, LogIn, LogOut } from "lucide-react";
import { type User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

type Voyage={id:string;name:string;origin:string;destination:string;originLat:number;originLng:number;destLat:number;destLng:number;departure:string;speed:number;status:"scheduled"|"active"|"paused"|"completed"};
type DbVoyage={id:string;name:string;origin:string;destination:string;origin_lat:number;origin_lng:number;dest_lat:number;dest_lng:number;departure:string;speed:number;status:Voyage["status"]};
const supabase=createClient("https://lolbrqyvwedtaksytalu.supabase.co","sb_publishable_9ZetRCffg-zcklv5rifkFA_AwDDGAtO");
const fromDb=(v:DbVoyage):Voyage=>({id:v.id,name:v.name,origin:v.origin,destination:v.destination,originLat:v.origin_lat,originLng:v.origin_lng,destLat:v.dest_lat,destLng:v.dest_lng,departure:v.departure,speed:v.speed,status:v.status});

const shipIcon=(number:string,name:string)=>L.divIcon({className:"ship-marker",html:`<div class="ship-bubble"><span class="ship-side-icon" aria-hidden="true"><svg viewBox="0 0 72 38" xmlns="http://www.w3.org/2000/svg"><path d="M4 25h49l9-7 6 7-8 7H18c-6 0-11-2-14-7Z" fill="#e83b3b" stroke="#fff" stroke-width="1.8"/><path d="M8 25h45l-3 4H18c-5 0-8-1-10-4Z" fill="#ffb52e"/><path d="M16 23V12h34v11" fill="#ffc83d" stroke="#fff" stroke-width="1.5"/><path d="M20 21h8v-8h7v8h9v-8h6v8" fill="#ff6b35"/><path d="M23 12V7h8v5M34 12V5h8v7M45 12V8h5v4" fill="#22a6a6" stroke="#fff" stroke-width="1.4"/><path d="M25 13v7M34 13v7M43 13v7" stroke="#ffe16b" stroke-width="2"/><path d="M10 27h43" stroke="#fff" stroke-width="2"/><path d="M7 31c5 2 10 2 15 0" fill="none" stroke="#38d9a8" stroke-width="2"/></svg></span><div class="ship-label"><b>${number}</b><small>${name}</small></div></div>`,iconSize:[230,42],iconAnchor:[24,21]});
const endpointIcon=(label:string,type:"departure"|"destination")=>L.divIcon({className:"endpoint-marker",html:`<div class="endpoint-label ${type}"><i></i><span>${label}</span></div>`,iconSize:[170,28],iconAnchor:type==="departure"?[0,14]:[170,14]});

type Waypoint=[number,number];

const oceanCorridor=(v:Voyage):Waypoint[]=>{
  const key=(v.origin+" "+v.destination).toLowerCase();
  if(key.includes("vancouver")&&key.includes("karachi")){
    return [
      [v.originLat,v.originLng],
      [48.0,-128.0],[43.0,-132.0],[36.0,-136.0],[28.0,-132.0],
      [20.0,-125.0],[12.0,-116.0],[5.0,-105.0],[-2.0,-92.0],
      [0.0,-80.0],[5.0,-70.0],[10.0,-60.0],[12.0,-50.0],
      [14.0,-40.0],[18.0,-30.0],[22.0,-20.0],[25.0,-10.0],
      [28.0,0.0],[30.0,10.0],[30.0,20.0],[25.0,30.0],
      [18.0,40.0],[12.0,50.0],[8.0,58.0],[10.0,62.0],
      [13.0,65.0],[16.0,67.0],[19.0,66.0],[v.destLat,v.destLng]
    ];
  }
  return [[v.originLat,v.originLng],[v.destLat,v.destLng]];
};

function corridorDistance(points:Waypoint[]){
  let total=0;
  for(let i=1;i<points.length;i++) total+=distance(points[i-1][0],points[i-1][1],points[i][0],points[i][1]);
  return total;
}

function positionOnCorridor(points:Waypoint,traveled:number){
  let remaining=traveled;
  for(let i=1;i<points.length;i++){
    const [lat1,lng1]=points[i-1], [lat2,lng2]=points[i];
    const leg=distance(lat1,lng1,lat2,lng2);
    if(remaining<=leg){
      const p=leg?remaining/leg:0;
      return {lat:lat1+(lat2-lat1)*p,lng:lng1+(lng2-lng1)*p};
    }
    remaining-=leg;
  }
  const last=points[points.length-1];
  return {lat:last[0],lng:last[1]};
}

function interpolate(v:Voyage){
  const elapsed=Math.max(0,(Date.now()-new Date(v.departure).getTime())/3600000);
  const points=oceanCorridor(v);
  const totalDist=corridorDistance(points);
  const traveled=Math.min(totalDist,elapsed*v.speed);
  const p=totalDist?traveled/totalDist:0;
  const point=positionOnCorridor(points,traveled);
  return {lat:point.lat,lng:point.lng,p,elapsed,totalDist,traveled,remaining:Math.max(0,totalDist-traveled)};
}
function distance(a:number,b:number,c:number,d:number){const R=3440.065;const p1=a*Math.PI/180,p2=c*Math.PI/180,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180;const x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function Fit({v}:{v:Voyage}){const map=useMap();useEffect(()=>{map.fitBounds([[v.originLat,v.originLng],[v.destLat,v.destLng]],{padding:[30,30]})},[map,v]);return null}

export default function App(){
 const [voyages,setVoyages]=useState<Voyage[]>([]);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const [selected,setSelected]=useState<Voyage|undefined>(undefined);

 const [now,setNow]=useState(Date.now());
 const [user,setUser]=useState<User|null>(null);
 const [loginOpen,setLoginOpen]=useState(false);
 const [username,setUsername]=useState("");
 const [password,setPassword]=useState("");
 const [loginBusy,setLoginBusy]=useState(false);
 const [showNew,setShowNew]=useState(false);
 const [vesselNumber,setVesselNumber]=useState("");
 const [searching,setSearching]=useState(false);
 const [deleting,setDeleting]=useState<string|null>(null);
 const defaultDeparture=()=>{const d=new Date(Date.now()-3*24*60*60*1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
 const [form,setForm]=useState({number:"",name:"",origin:"",destination:"",departure:defaultDeparture(),speed:"13"});
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setUser(data.session?.user??null));const {data}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!user){setVoyages([]);setSelected(undefined);setLoading(false);return;}let alive=true;(async()=>{setLoading(true);const {data,error}=await supabase.from("voyages").select("*").order("created_at",{ascending:false});if(!alive)return;if(error){setMessage("Unable to load voyage records.");setVoyages([]);}else{setVoyages((data as DbVoyage[]).map(fromDb));}setLoading(false)})();return()=>{alive=false}},[user]);
 const pos=selected?interpolate(selected):null;
 const eta=pos&&selected?new Date(new Date(selected.departure).getTime()+pos.totalDist/selected.speed*3600000):null;
 const route=selected?oceanCorridor(selected):[];
 const progress=pos?Math.round(pos.p*100):0;
 const login=async()=>{setLoginBusy(true);setMessage("");
   const {data:admin,error:lookupError}=await supabase.from("admin_users").select("email").eq("username",username.trim()).maybeSingle();
   if(lookupError||!admin){setLoginBusy(false);setMessage("Invalid username or password.");return;}
   const {data,error}=await supabase.auth.signInWithPassword({email:admin.email,password});
   setLoginBusy(false);if(error){setMessage("Invalid username or password.");return;}
   setUser(data.user);setUsername("");setPassword("");setLoginOpen(false);setMessage("Admin login successful.");};
 const logout=async()=>{await supabase.auth.signOut();setShowNew(false);setMessage("Signed out.");};
 const geocode=async(place:string)=>{const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(place);const res=await fetch(url,{headers:{Accept:"application/json"}});if(!res.ok)throw new Error("Location lookup failed.");const data=await res.json();if(!data[0])throw new Error("Location not found: "+place);return {lat:Number(data[0].lat),lng:Number(data[0].lon)};};
 const searchVessel=async()=>{const number=vesselNumber.trim().toUpperCase();if(!number){setMessage("Enter a vessel number to search.");return;}setSearching(true);setMessage("Searching vessel records…");const {data,error}=await supabase.from("voyages").select("*").eq("id",number).maybeSingle();setSearching(false);if(error){setMessage("Unable to search vessel records.");return;}if(!data){setSelected(undefined);setMessage("No vessel found with number "+number+".");return;}const v=fromDb(data as DbVoyage);setSelected(v);setMessage("Vessel "+v.id+" found.");};
 const deleteVoyage=async(v:Voyage)=>{if(!user)return;if(!window.confirm("Delete vessel "+v.id+" ("+v.name+")? This cannot be undone."))return;setDeleting(v.id);setMessage("");const {error}=await supabase.from("voyages").delete().eq("id",v.id);setDeleting(null);if(error){setMessage("Unable to delete vessel: "+error.message);return;}setVoyages(x=>x.filter(item=>item.id!==v.id));if(selected?.id===v.id)setSelected(undefined);setMessage("Vessel "+v.id+" deleted.");};
 const create=async()=>{if(!user){setLoginOpen(true);return;}const number=form.number.trim().toUpperCase(),name=form.name.trim(),origin=form.origin.trim(),destination=form.destination.trim(),departure=form.departure.trim();const missing=[!number?"vessel number":"",!name?"vessel name":"",!origin?"origin":"",!destination?"destination":"",!departure?"departure time":""].filter(Boolean);if(missing.length){setMessage("Please enter: "+missing.join(", ")+".");return;}setMessage("Finding origin and destination…");const nOrigin=await geocode(origin).catch((e)=>{setMessage(e.message);return null});if(!nOrigin)return;const nDest=await geocode(form.destination).catch((e)=>{setMessage(e.message);return null});if(!nDest)return;const n:Voyage={id:number,name,origin,destination,originLat:nOrigin.lat,originLng:nOrigin.lng,destLat:nDest.lat,destLng:nDest.lng,departure:new Date(departure).toISOString(),speed:Number(form.speed)||13,status:"active"};
const {error}=await supabase.from("voyages").insert({id:n.id,name:n.name,origin:n.origin,destination:n.destination,origin_lat:n.originLat,origin_lng:n.originLng,dest_lat:n.destLat,dest_lng:n.destLng,departure:n.departure,speed:n.speed,status:n.status});
if(error){setMessage(error.message);return;}setVoyages(x=>[n,...x]);setSelected(n);setShowNew(false);setMessage("Voyage saved to Supabase.");};
 return <div className="app">
  <header><div className="brand"><ShipWheel size={28}/><div><strong>VesselTrack</strong><span>Voyage Monitoring</span></div></div><div className="header-actions"></div></header>
  <main>{message&&<div className="supabase-message">{message}</div>}{loading&&<div className="supabase-message">Loading voyages…</div>}{loginOpen&&!user&&<section className="admin-panel login-panel"><div className="panel-title"><div><span className="eyebrow">SECURE ACCESS</span><h2>Admin login</h2></div></div><div className="form-grid login-grid"><label>Username<input type="text" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button className="primary create" onClick={login} disabled={loginBusy}>{loginBusy?"Signing in…":<><LogIn size={17}/> Sign in</>}</button></div></section>}
   <section className="hero"><div className="hero-copy"><div className="eyebrow"><CircleDot size={12}/> LIVE TRACKING</div><h1>Monitor every voyage<br/><em>in real time.</em></h1><p>Track vessel movements, route progress and estimated arrival in real time.</p></div><div className="hero-ship" aria-label="Container ship at sea"><div className="hero-ship-overlay"></div><div className="status-card"><span>System status</span><b><i/>Tracking engine online</b><small>Updates every second</small></div></div></section>
   {!user&&<section className="search-panel"><div className="search-copy"><span className="eyebrow"><Navigation size={12}/> PUBLIC VESSEL SEARCH</span><h2>Track a vessel by vessel number</h2><p>Enter the vessel number provided by the administrator to view its current simulated position, route and voyage details.</p></div><div className="search-box"><input value={vesselNumber} onChange={e=>setVesselNumber(e.target.value.toUpperCase())} onKeyDown={e=>{if(e.key==="Enter")searchVessel()}} placeholder="Enter vessel number, e.g. VT-1001"/><button className="primary" onClick={searchVessel} disabled={searching}>{searching?"Searching…":"Find vessel"}</button></div></section>}
   {user&&<section className="admin-panel"><div className="panel-title"><div><span className="eyebrow">ADMIN CONTROL</span><h2>Voyage management</h2></div><button className="primary" onClick={()=>setShowNew(!showNew)}><Plus size={18}/> New voyage</button></div>{showNew&&<div className="form-grid">
    <label>Vessel number<input type="text" placeholder="e.g. VT-1001" value={form.number} onChange={e=>setForm({...form,number:e.target.value.toUpperCase()})}/></label>
    <label>Vessel name<input type="text" placeholder="e.g. MV Ocean Star" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Origin<input type="text" placeholder="e.g. Vancouver, Canada" value={form.origin} onChange={e=>setForm({...form,origin:e.target.value})}/></label>
    <label>Destination<input type="text" placeholder="e.g. Karachi, Pakistan" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}/></label>
    <label>Departure date/time<input type="datetime-local" value={form.departure} onChange={e=>setForm({...form,departure:e.target.value})}/></label>
    <label>Speed (knots)<input type="number" min="1" step="0.1" value={form.speed} onChange={e=>setForm({...form,speed:e.target.value})}/></label>
    <div className="form-help">Coordinates are found automatically from the origin and destination you enter.</div>
    <button className="primary create" onClick={create}><Play size={17}/> Start simulation</button>
   </div>}<div className="voyage-list">{voyages.map(v=><div className={"voyage-row "+(selected?.id===v.id?"selected":"")} key={v.id}><button className="voyage-select" onClick={()=>setSelected(v)}><span className="dot"/><strong>{v.name}</strong><span>{v.origin} → {v.destination}</span><b>{v.status}</b></button><button className="delete-voyage" onClick={()=>deleteVoyage(v)} disabled={deleting===v.id}>{deleting===v.id?"Deleting…":"Delete"}</button></div>)}</div></section>}
   <section className="workspace">
    <div className="map-wrap">{selected?<MapContainer center={[selected.originLat,selected.originLng]} zoom={3} scrollWheelZoom><TileLayer attribution='Tiles &copy; Esri — Ocean Base' url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"/><Fit v={selected}/><Polyline positions={route} pathOptions={{color:"#55a7ff",weight:4,opacity:.9}}/><Marker position={[selected.originLat,selected.originLng]} icon={endpointIcon(selected.origin,"departure")}/><Marker position={[selected.destLat,selected.destLng]} icon={endpointIcon(selected.destination,"destination")}/>{pos&&<Marker position={[pos.lat,pos.lng]} icon={shipIcon(selected.id,selected.name)}><Popup><b>{selected.name}</b><br/>Simulated live position</Popup></Marker>}</MapContainer>:<div className="map-empty"><ShipWheel size={42}/><h3>Search for a vessel</h3><p>Enter a vessel number above to display its live simulated route and position.</p></div>}</div>
    {selected&&pos&&<aside className="details"><div className="detail-top"><div><span className="eyebrow">ACTIVE VOYAGE</span><h2>{selected.name}</h2><p>{selected.origin} <span>→</span> {selected.destination}</p></div><span className="live"><i/> LIVE</span></div>
      <div className="progress"><div><span>Voyage progress</span><b>{progress}%</b></div><div className="bar"><i style={{width:progress+"%"}}/></div></div>
      <div className="metrics"><Metric icon={<Gauge/>} label="Speed" value={selected.speed.toFixed(1)+" kn"}/><Metric icon={<Navigation/>} label="Position" value={pos.lat.toFixed(4)+"°, "+pos.lng.toFixed(4)+"°"}/><Metric icon={<Route/>} label="Distance remaining" value={Math.round(pos.remaining).toLocaleString()+" NM"}/><Metric icon={<Clock3/>} label="Estimated arrival" value={eta?.toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})||"—"}/></div>
      <div className="route-box"><div><span>DEPARTURE</span><strong>{selected.origin}</strong></div><div className="line"><i/><i/><i/></div><div className="align-right"><span>DESTINATION</span><strong>{selected.destination}</strong></div></div>
      <div className="note"><Anchor size={17}/><span></span></div>
    </aside>}
   </section>
  </main>
  <footer><div className="footer-brand"><strong>VesselTrack</strong><small>Vessel monitoring platform • v0.1</small></div><button className="footer-login" onClick={()=>user?logout():setLoginOpen(!loginOpen)}>{user?<><LogOut size={13}/> Sign out</>:<><LogIn size={13}/> Admin Login</>}</button></footer>
 </div>
}
function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong></div>
}
