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

const demo:Voyage[]=[{id:"VT-001",name:"MV Ocean Star",origin:"Vancouver, Canada",destination:"Karachi, Pakistan",originLat:49.2827,originLng:-123.1207,destLat:24.8607,destLng:67.0011,departure:new Date(Date.now()-72*3600000).toISOString(),speed:13,status:"active"}];

const shipIcon=L.divIcon({className:"ship-marker",html:"<div>🚢</div>",iconSize:[42,42],iconAnchor:[21,21]});

function interpolate(v:Voyage){
  const elapsed=Math.max(0,(Date.now()-new Date(v.departure).getTime())/3600000);
  const totalDist=distance(v.originLat,v.originLng,v.destLat,v.destLng);
  const traveled=Math.min(totalDist,elapsed*v.speed);
  const p=totalDist?traveled/totalDist:0;
  return {lat:v.originLat+(v.destLat-v.originLat)*p,lng:v.originLng+(v.destLng-v.originLng)*p,p,elapsed,totalDist,traveled,remaining:Math.max(0,totalDist-traveled)};
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
 const defaultDeparture=()=>{const d=new Date(Date.now()-3*24*60*60*1000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
 const [form,setForm]=useState({name:"",origin:"",destination:"",departure:defaultDeparture(),speed:"13"});
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setUser(data.session?.user??null));const {data}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{let alive=true;(async()=>{const {data,error}=await supabase.from("voyages").select("*").order("created_at",{ascending:false});if(!alive)return;if(error){setMessage("Supabase is not connected yet. Run supabase/schema.sql in the SQL Editor.");setVoyages(demo);setSelected(demo[0]);}else{const rows=(data as DbVoyage[]).map(fromDb);setVoyages(rows.length?rows:demo);setSelected(rows[0]||demo[0]);}setLoading(false)})();return()=>{alive=false}},[]);
 const pos=selected?interpolate(selected):null;
 const eta=pos&&selected?new Date(new Date(selected.departure).getTime()+pos.totalDist/selected.speed*3600000):null;
 const route=selected?[[selected.originLat,selected.originLng],[selected.destLat,selected.destLng]] as [number,number][]:[];
 const progress=pos?Math.round(pos.p*100):0;
 const login=async()=>{setLoginBusy(true);setMessage("");
   const {data:admin,error:lookupError}=await supabase.from("admin_users").select("email").eq("username",username.trim()).maybeSingle();
   if(lookupError||!admin){setLoginBusy(false);setMessage("Invalid username or password.");return;}
   const {data,error}=await supabase.auth.signInWithPassword({email:admin.email,password});
   setLoginBusy(false);if(error){setMessage("Invalid username or password.");return;}
   setUser(data.user);setUsername("");setPassword("");setLoginOpen(false);setMessage("Admin login successful.");};
 const logout=async()=>{await supabase.auth.signOut();setShowNew(false);setMessage("Signed out.");};
 const geocode=async(place:string)=>{const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(place);const res=await fetch(url,{headers:{Accept:"application/json"}});if(!res.ok)throw new Error("Location lookup failed.");const data=await res.json();if(!data[0])throw new Error("Location not found: "+place);return {lat:Number(data[0].lat),lng:Number(data[0].lon)};};
 const create=async()=>{if(!user){setLoginOpen(true);return;}const name=form.name.trim(),origin=form.origin.trim(),destination=form.destination.trim(),departure=form.departure.trim();const missing=[!name?"vessel name":"",!origin?"origin":"",!destination?"destination":"",!departure?"departure time":""].filter(Boolean);if(missing.length){setMessage("Please enter: "+missing.join(", ")+".");return;}setMessage("Finding origin and destination…");const nOrigin=await geocode(origin).catch((e)=>{setMessage(e.message);return null});if(!nOrigin)return;const nDest=await geocode(form.destination).catch((e)=>{setMessage(e.message);return null});if(!nDest)return;const n:Voyage={id:"VT-"+String(Date.now()).slice(-6),name:form.name,origin:form.origin,destination:form.destination,originLat:nOrigin.lat,originLng:nOrigin.lng,destLat:nDest.lat,destLng:nDest.lng,departure:new Date(form.departure).toISOString(),speed:Number(form.speed)||13,status:"active"};
const {error}=await supabase.from("voyages").insert({id:n.id,name:n.name,origin:n.origin,destination:n.destination,origin_lat:n.originLat,origin_lng:n.originLng,dest_lat:n.destLat,dest_lng:n.destLng,departure:n.departure,speed:n.speed,status:n.status});
if(error){setMessage(error.message);return;}setVoyages(x=>[n,...x]);setSelected(n);setShowNew(false);setMessage("Voyage saved to Supabase.");};
 return <div className="app">
  <header><div className="brand"><ShipWheel size={28}/><div><strong>VesselTrack</strong><span>Custom Voyage Monitoring</span></div></div><div className="header-actions">{user?<button className="ghost" onClick={logout}><LogOut size={17}/> Sign out</button>:<button className="ghost" onClick={()=>setLoginOpen(!loginOpen)}><LogIn size={17}/> Admin Login</button>}</div></header>
  <main>{message&&<div className="supabase-message">{message}</div>}{loading&&<div className="supabase-message">Loading voyages…</div>}{loginOpen&&!user&&<section className="admin-panel login-panel"><div className="panel-title"><div><span className="eyebrow">SECURE ACCESS</span><h2>Admin login</h2></div></div><div className="form-grid login-grid"><label>Username<input type="text" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button className="primary create" onClick={login} disabled={loginBusy}>{loginBusy?"Signing in…":<><LogIn size={17}/> Sign in</>}</button></div></section>}
   <section className="hero"><div><div className="eyebrow"><CircleDot size={12}/> SIMULATED LIVE TRACKING</div><h1>Monitor every voyage<br/><em>in real time.</em></h1><p>Admin-controlled vessel simulation with automatic position, distance and ETA calculations.</p></div><div className="status-card"><span>System status</span><b><i/>Simulation engine online</b><small>Updates every second in this preview</small></div></section>
   {user&&<section className="admin-panel"><div className="panel-title"><div><span className="eyebrow">ADMIN CONTROL</span><h2>Voyage management</h2></div><button className="primary" onClick={()=>setShowNew(!showNew)}><Plus size={18}/> New voyage</button></div>{showNew&&<div className="form-grid">
    <label>Vessel name<input type="text" placeholder="e.g. MV Ocean Star" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>Origin<input type="text" placeholder="e.g. Vancouver, Canada" value={form.origin} onChange={e=>setForm({...form,origin:e.target.value})}/></label>
    <label>Destination<input type="text" placeholder="e.g. Karachi, Pakistan" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}/></label>
    <label>Departure date/time<input type="datetime-local" value={form.departure} onChange={e=>setForm({...form,departure:e.target.value})}/></label>
    <label>Speed (knots)<input type="number" min="1" step="0.1" value={form.speed} onChange={e=>setForm({...form,speed:e.target.value})}/></label>
    <div className="form-help">Coordinates are found automatically from the origin and destination you enter.</div>
    <button className="primary create" onClick={create}><Play size={17}/> Start simulation</button>
   </div>}<div className="voyage-list">{voyages.map(v=><button className={"voyage-row "+(selected?.id===v.id?"selected":"")} key={v.id} onClick={()=>setSelected(v)}><span className="dot"/><strong>{v.name}</strong><span>{v.origin} → {v.destination}</span><b>{v.status}</b></button>)}</div></section>}
   <section className="workspace">
    <div className="map-wrap">{selected&&<MapContainer center={[selected.originLat,selected.originLng]} zoom={3} scrollWheelZoom><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Fit v={selected}/><Polyline positions={route} pathOptions={{color:"#5b8def",weight:3,dashArray:"8 9"}}/><Marker position={[selected.originLat,selected.originLng]}><Popup>Departure: {selected.origin}</Popup></Marker><Marker position={[selected.destLat,selected.destLng]}><Popup>Destination: {selected.destination}</Popup></Marker>{pos&&<Marker position={[pos.lat,pos.lng]} icon={shipIcon}><Popup><b>{selected.name}</b><br/>Simulated live position</Popup></Marker>}</MapContainer>}</div>
    {selected&&pos&&<aside className="details"><div className="detail-top"><div><span className="eyebrow">ACTIVE VOYAGE</span><h2>{selected.name}</h2><p>{selected.origin} <span>→</span> {selected.destination}</p></div><span className="live"><i/> LIVE</span></div>
      <div className="progress"><div><span>Voyage progress</span><b>{progress}%</b></div><div className="bar"><i style={{width:progress+"%"}}/></div></div>
      <div className="metrics"><Metric icon={<Gauge/>} label="Speed" value={selected.speed.toFixed(1)+" kn"}/><Metric icon={<Navigation/>} label="Position" value={pos.lat.toFixed(4)+"°, "+pos.lng.toFixed(4)+"°"}/><Metric icon={<Route/>} label="Distance remaining" value={Math.round(pos.remaining).toLocaleString()+" NM"}/><Metric icon={<Clock3/>} label="Estimated arrival" value={eta?.toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})||"—"}/></div>
      <div className="route-box"><div><span>DEPARTURE</span><strong>{selected.origin}</strong></div><div className="line"><i/><i/><i/></div><div className="align-right"><span>DESTINATION</span><strong>{selected.destination}</strong></div></div>
      <div className="note"><Anchor size={17}/><span>Custom simulation. Position is calculated from voyage parameters and elapsed time; it is not AIS data.</span></div>
    </aside>}
   </section>
  </main>
  <footer><span>VesselTrack</span><span>Custom simulation platform • v0.1</span></footer>
 </div>
}
function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong></div>
}
