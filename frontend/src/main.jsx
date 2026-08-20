import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import Signup from './Signup.jsx';
import './styles.css';
import './theme.css';

const API=(import.meta.env.VITE_API_URL||'http://localhost:5000/api').replace(/\/$/,'');
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input?.url||'';if(!url.startsWith(API))return nativeFetch(input,init);let lastError;for(let attempt=1;attempt<=3;attempt++){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);try{const response=await nativeFetch(input,{...init,signal:controller.signal});clearTimeout(timer);if(response.ok||response.status<500||attempt===3)return response;lastError=new Error(`Server returned ${response.status}`)}catch(error){clearTimeout(timer);lastError=error}await new Promise(resolve=>setTimeout(resolve,1500*attempt))}throw lastError||new Error('RibhuTrack server is temporarily unavailable')};
const wakeServer=()=>nativeFetch(`${API}/health`,{cache:'no-store'}).catch(()=>{});wakeServer();setInterval(wakeServer,10*60*1000);
const SESSION_LIMIT=60*60*1000;

function LoginPanel({onLogin}){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');
    try{
      const r=await nativeFetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.message||'Invalid email or password');
      localStorage.setItem('rt_token',data.token);
      localStorage.setItem('rt_teacher',JSON.stringify(data.teacher));
      localStorage.setItem('rt_login_at',String(Date.now()));
      onLogin();
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <div className="auth-panel auth-login-panel">
    <div className="brand-mark">RT</div>
    <div className="eyebrow">WELCOME BACK</div>
    <h1>Sign in to <span>RibhuTrack</span></h1>
    <p className="muted">Continue managing your classes, students and attendance.</p>
    <form onSubmit={submit}>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="teacher@example.com" required/></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required/></label>
      {error&&<div className="error">{error}</div>}
      <button className="primary full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form>
    <div className="auth-note">Already registered? Sign in with your account.</div>
  </div>
}

function AuthPage({onLogin}){
  return <div className="auth-split-page">
    <div className="auth-side auth-signup-side">
      <Signup embedded onSignIn={()=>{}} onRegistered={onLogin}/>
    </div>
    <div className="auth-divider"><span>OR</span></div>
    <div className="auth-side auth-login-side">
      <LoginPanel onLogin={onLogin}/>
    </div>
  </div>;
}

function AuthGate(){
  const [mode,setMode]=useState(localStorage.getItem('rt_token')?'app':'auth');
  useEffect(()=>{
    const checkSession=()=>{
      const token=localStorage.getItem('rt_token');
      if(!token){setMode('auth');return}
      let started=Number(localStorage.getItem('rt_login_at'));
      if(!started||Number.isNaN(started)){started=Date.now();localStorage.setItem('rt_login_at',String(started))}
      if(Date.now()-started>=SESSION_LIMIT){
        localStorage.removeItem('rt_token');localStorage.removeItem('rt_teacher');localStorage.removeItem('rt_login_at');setMode('auth');
      }
    };
    checkSession();
    const timer=setInterval(checkSession,5000);
    return ()=>clearInterval(timer);
  },[]);
  if(mode==='auth')return <AuthPage onLogin={()=>setMode('app')}/>;
  return <App/>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AuthGate/></React.StrictMode>);
