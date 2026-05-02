
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const today = () => new Date().toISOString().slice(0, 10);
const blankDate = (v) => (v && String(v).trim() ? v : null);
const fullName = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'New Client';
const slug = (t) => (t || '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
const makeFile = (type, c, date) => `${date || today()}_${slug(c?.last_name)}_${slug(c?.first_name)}_${type}.pdf`;

function Field({ label, value, onChange, type = 'text', textarea = false }) {
  return <label className="field"><span>{label}</span>{textarea ? <textarea value={value || ''} onChange={(e)=>onChange(e.target.value)} /> : <input type={type} value={value || ''} onChange={(e)=>onChange(e.target.value)} />}</label>;
}

function Login() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  async function login(e){ e.preventDefault(); const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) alert(error.message); }
  return <div className="loginPage"><form className="loginCard" onSubmit={login}><h1>YOHOME Clinic Records</h1><p>Secure staff login for client intake and SOAP records.</p><Field label="Email" value={email} onChange={setEmail}/><Field label="Password" type="password" value={password} onChange={setPassword}/><button className="primary">Sign In</button></form></div>;
}

function PrintBlock({title,text}){ return <section className="printBlock"><h3>{title}</h3><p>{text || '-'}</p></section>; }

function Printable({ data, close }) {
  if(!data) return null;
  const { type, client, record } = data;
  const isIntake = type === 'Intake';
  const date = isIntake ? record.form_date : record.session_date;
  return <div className="printOverlay"><div className="printToolbar noPrint"><button className="secondary" onClick={close}>Close</button><button className="primary" onClick={()=>window.print()}>Print / Save PDF</button></div><div className="printPage"><header className="printHeader"><div><h1>{type} Record</h1><p>YOHOME Massage & Myotherapy</p></div><div className="right"><b>{fullName(client)}</b><br/>{date || today()}<br/>Therapist: {record.therapist || '-'}</div></header><div className="printInfo"><p><b>Client:</b> {fullName(client)}</p><p><b>Phone:</b> {client.phone || '-'}</p><p><b>Email:</b> {client.email || '-'}</p><p><b>Suggested file:</b> {record.file_name || makeFile(type, client, date)}</p></div>{isIntake ? <><PrintBlock title="Main Reason" text={record.main_reason}/><PrintBlock title="Conditions / Injuries" text={record.conditions_injuries}/><PrintBlock title="Medications" text={record.medications}/><PrintBlock title="Allergies" text={record.allergies}/><PrintBlock title="Areas to Avoid" text={record.areas_to_avoid}/><PrintBlock title="Consent Notes" text={record.consent_notes}/></> : <><PrintBlock title="Subjective" text={record.subjective}/><PrintBlock title="Objective" text={record.objective}/><PrintBlock title="Assessment" text={record.assessment}/><PrintBlock title="Plan" text={record.plan}/><PrintBlock title="Techniques Used" text={record.techniques_used}/><PrintBlock title="Session Duration" text={record.session_duration}/><PrintBlock title="Next Review" text={record.next_review}/></>}</div></div>;
}

function App(){
  const [session,setSession]=useState(null);
  const [clients,setClients]=useState([]);
  const [selected,setSelected]=useState(null);
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState('profile');
  const [printData,setPrintData]=useState(null);
  const [clientForm,setClientForm]=useState({first_name:'',last_name:'',phone:'',email:'',date_of_birth:'',address:'',emergency_contact:'',notes:''});
  const [intake,setIntake]=useState({form_date:today(),therapist:'',main_reason:'',conditions_injuries:'',medications:'',allergies:'',areas_to_avoid:'',consent_notes:'Client confirms the information provided is accurate and consents to treatment within scope.'});
  const [soap,setSoap]=useState({session_date:today(),therapist:'',subjective:'',objective:'',assessment:'',plan:'',techniques_used:'',session_duration:'',next_review:''});
  const [intakes,setIntakes]=useState([]);
  const [soaps,setSoaps]=useState([]);

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>setSession(data.session)); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>data.subscription.unsubscribe(); },[]);
  useEffect(()=>{ if(session) loadClients(); },[session]);
  useEffect(()=>{ if(selected){ setClientForm({...selected,date_of_birth:selected.date_of_birth || ''}); loadRecords(selected.id); } },[selected]);

  const filtered = useMemo(()=>clients.filter(c=>`${c.first_name} ${c.last_name} ${c.phone||''} ${c.email||''}`.toLowerCase().includes(query.toLowerCase())),[clients,query]);

  async function loadClients(){ const {data,error}=await supabase.from('clients').select('*').order('created_at',{ascending:false}); if(error) return alert(error.message); setClients(data||[]); if(!selected && data?.length) setSelected(data[0]); }
  async function loadRecords(id){ const [a,b]=await Promise.all([supabase.from('intake_forms').select('*').eq('client_id',id).order('created_at',{ascending:false}),supabase.from('soap_notes').select('*').eq('client_id',id).order('created_at',{ascending:false})]); if(a.error) alert(a.error.message); if(b.error) alert(b.error.message); setIntakes(a.data||[]); setSoaps(b.data||[]); }
  function newClient(){ setSelected(null); setClientForm({first_name:'',last_name:'',phone:'',email:'',date_of_birth:'',address:'',emergency_contact:'',notes:''}); setIntakes([]); setSoaps([]); setTab('profile'); }
  async function saveClient(e){ e.preventDefault(); const payload={...clientForm,date_of_birth:blankDate(clientForm.date_of_birth),created_by:session.user.id}; const result=selected?.id ? await supabase.from('clients').update(payload).eq('id',selected.id).select().single() : await supabase.from('clients').insert(payload).select().single(); if(result.error) return alert(result.error.message); setSelected(result.data); await loadClients(); alert('Client saved.'); }
  async function saveIntake(e){ e.preventDefault(); if(!selected?.id) return alert('Please select or save a client first.'); const payload={...intake,form_date:blankDate(intake.form_date),client_id:selected.id,file_name:makeFile('Intake',selected,intake.form_date),created_by:session.user.id}; const {data,error}=await supabase.from('intake_forms').insert(payload).select().single(); if(error) return alert(error.message); await loadRecords(selected.id); setPrintData({type:'Intake',client:selected,record:data}); }
  async function saveSoap(e){ e.preventDefault(); if(!selected?.id) return alert('Please select or save a client first.'); const payload={...soap,session_date:blankDate(soap.session_date),client_id:selected.id,file_name:makeFile('SOAP',selected,soap.session_date),created_by:session.user.id}; const {data,error}=await supabase.from('soap_notes').insert(payload).select().single(); if(error) return alert(error.message); await loadRecords(selected.id); setPrintData({type:'SOAP',client:selected,record:data}); }

  if(!session) return <Login/>;
  return <><Printable data={printData} close={()=>setPrintData(null)}/><div className="app"><aside><div className="brand"><h1>YOHOME</h1><p>Clinic Records V3</p></div><button className="primary full" onClick={newClient}>+ New Client</button><input className="search" placeholder="Search clients..." value={query} onChange={(e)=>setQuery(e.target.value)}/><div className="clientList">{filtered.map(c=><button className={selected?.id===c.id?'client active':'client'} key={c.id} onClick={()=>setSelected(c)}><b>{fullName(c)}</b><span>{c.phone || c.email || 'No contact'}</span></button>)}</div><button className="secondary full" onClick={()=>supabase.auth.signOut()}>Sign Out</button></aside><main><header className="top"><h2>{selected ? fullName(selected) : 'New Client'}</h2><p>Each client's intake and SOAP history is separated and linked to their own file.</p></header><nav className="tabs"><button className={tab==='profile'?'on':''} onClick={()=>setTab('profile')}>Client Profile</button><button className={tab==='intake'?'on':''} onClick={()=>setTab('intake')}>New Intake</button><button className={tab==='soap'?'on':''} onClick={()=>setTab('soap')}>New SOAP</button><button className={tab==='history'?'on':''} onClick={()=>setTab('history')}>History</button></nav>{tab==='profile'&&<form className="card grid" onSubmit={saveClient}><Field label="First Name" value={clientForm.first_name} onChange={(v)=>setClientForm({...clientForm,first_name:v})}/><Field label="Last Name" value={clientForm.last_name} onChange={(v)=>setClientForm({...clientForm,last_name:v})}/><Field label="Phone" value={clientForm.phone} onChange={(v)=>setClientForm({...clientForm,phone:v})}/><Field label="Email" value={clientForm.email} onChange={(v)=>setClientForm({...clientForm,email:v})}/><Field label="Date of Birth" type="date" value={clientForm.date_of_birth} onChange={(v)=>setClientForm({...clientForm,date_of_birth:v})}/><Field label="Address" value={clientForm.address} onChange={(v)=>setClientForm({...clientForm,address:v})}/><Field label="Emergency Contact" textarea value={clientForm.emergency_contact} onChange={(v)=>setClientForm({...clientForm,emergency_contact:v})}/><Field label="Notes" textarea value={clientForm.notes} onChange={(v)=>setClientForm({...clientForm,notes:v})}/><button className="primary span2">Save Client</button></form>}{tab==='intake'&&<form className="card grid" onSubmit={saveIntake}><Field label="Form Date" type="date" value={intake.form_date} onChange={(v)=>setIntake({...intake,form_date:v})}/><Field label="Therapist" value={intake.therapist} onChange={(v)=>setIntake({...intake,therapist:v})}/><Field label="Main Reason" textarea value={intake.main_reason} onChange={(v)=>setIntake({...intake,main_reason:v})}/><Field label="Conditions / Injuries" textarea value={intake.conditions_injuries} onChange={(v)=>setIntake({...intake,conditions_injuries:v})}/><Field label="Medications" textarea value={intake.medications} onChange={(v)=>setIntake({...intake,medications:v})}/><Field label="Allergies" textarea value={intake.allergies} onChange={(v)=>setIntake({...intake,allergies:v})}/><Field label="Areas to Avoid" textarea value={intake.areas_to_avoid} onChange={(v)=>setIntake({...intake,areas_to_avoid:v})}/><Field label="Consent Notes" textarea value={intake.consent_notes} onChange={(v)=>setIntake({...intake,consent_notes:v})}/><button className="primary span2">Save Intake + Open PDF</button></form>}{tab==='soap'&&<form className="card grid" onSubmit={saveSoap}><Field label="Session Date" type="date" value={soap.session_date} onChange={(v)=>setSoap({...soap,session_date:v})}/><Field label="Therapist" value={soap.therapist} onChange={(v)=>setSoap({...soap,therapist:v})}/><Field label="Subjective" textarea value={soap.subjective} onChange={(v)=>setSoap({...soap,subjective:v})}/><Field label="Objective" textarea value={soap.objective} onChange={(v)=>setSoap({...soap,objective:v})}/><Field label="Assessment" textarea value={soap.assessment} onChange={(v)=>setSoap({...soap,assessment:v})}/><Field label="Plan" textarea value={soap.plan} onChange={(v)=>setSoap({...soap,plan:v})}/><Field label="Techniques Used" textarea value={soap.techniques_used} onChange={(v)=>setSoap({...soap,techniques_used:v})}/><Field label="Session Duration" value={soap.session_duration} onChange={(v)=>setSoap({...soap,session_duration:v})}/><Field label="Next Review" value={soap.next_review} onChange={(v)=>setSoap({...soap,next_review:v})}/><button className="primary span2">Save SOAP + Open PDF</button></form>}{tab==='history'&&<div className="history"><section className="card"><h3>Intake Forms</h3>{intakes.map(r=><article className="record" key={r.id}><b>{r.form_date || r.created_at?.slice(0,10)} · {r.therapist || 'No therapist'}</b><p>{r.main_reason || '-'}</p><button className="secondary" onClick={()=>setPrintData({type:'Intake',client:selected,record:r})}>Print / Save PDF</button></article>)}</section><section className="card"><h3>SOAP Notes</h3>{soaps.map(r=><article className="record" key={r.id}><b>{r.session_date || r.created_at?.slice(0,10)} · {r.therapist || 'No therapist'}</b><p><b>S:</b> {r.subjective || '-'}</p><p><b>O:</b> {r.objective || '-'}</p><p><b>A:</b> {r.assessment || '-'}</p><p><b>P:</b> {r.plan || '-'}</p><button className="secondary" onClick={()=>setPrintData({type:'SOAP',client:selected,record:r})}>Print / Save PDF</button></article>)}</section></div>}</main></div></>;
}

createRoot(document.getElementById('root')).render(<App/>);
