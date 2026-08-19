import {useState} from 'react';

const API=(import.meta.env.VITE_API_URL||'http://localhost:5000/api').replace(/\/$/,'');

async function request(path,options={}){
  const res=await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message||'Request failed');
  return data;
}

export default function Signup({onSignIn,onRegistered}){
  const [form,setForm]=useState({name:'',email:'',password:'',confirm:''});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}));

  async function submit(e){
    e.preventDefault(); setError(''); setSuccess('');
    if(form.password!==form.confirm){setError('Passwords do not match');return;}
    if(form.password.length<6){setError('Password must be at least 6 characters');return;}
    setBusy(true);
    try{
      await request('/auth/register',{method:'POST',body:JSON.stringify({name:form.name.trim(),email:form.email.trim(),password:form.password})});
      const login=await request('/auth/login',{method:'POST',body:JSON.stringify({email:form.email.trim(),password:form.password})});
      localStorage.setItem('rt_token',login.token);
      localStorage.setItem('rt_teacher',JSON.stringify(login.teacher));
      setSuccess('Account created successfully. Opening RibhuTrack…');
      setTimeout(()=>onRegistered(login.teacher),400);
    }catch(err){setError(err.message)} finally{setBusy(false)}
  }

  return <div className="login-page">
    <div className="login-card">
      <div className="brand-mark">RT</div>
      <div className="eyebrow">TEACHER MANAGEMENT</div>
      <h1>Create your <span>RibhuTrack</span> account</h1>
      <p className="muted">Start managing your classes, students and attendance.</p>
      <form onSubmit={submit}>
        <label>Full name<input value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Ribhu Tiwari" required/></label>
        <label>Email<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="teacher@example.com" required/></label>
        <label>Password<input type="password" value={form.password} onChange={e=>update('password',e.target.value)} placeholder="Minimum 6 characters" minLength="6" required/></label>
        <label>Confirm password<input type="password" value={form.confirm} onChange={e=>update('confirm',e.target.value)} placeholder="Re-enter your password" required/></label>
        {error&&<div className="error">{error}</div>}
        {success&&<div style={{background:'#e8f8ee',color:'#24864d',borderRadius:8,padding:10,fontSize:12}}>{success}</div>}
        <button className="primary full" disabled={busy}>{busy?'Creating account…':'Create account'}</button>
      </form>
      <div className="login-tip">Already have an account? <button type="button" onClick={onSignIn} style={{border:0,background:'transparent',color:'#6855df',fontWeight:700,cursor:'pointer',padding:0}}>Sign in</button></div>
    </div>
  </div>;
}
