import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import Signup from './Signup.jsx';
import './styles.css';

const API=(import.meta.env.VITE_API_URL||'http://localhost:5000/api').replace(/\/$/,'');

// Render Free services can sleep after inactivity. This wrapper gives the API
// enough time to wake up and retries transient failures automatically.
const nativeFetch=window.fetch.bind(window);
window.fetch=async (input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  if(!url.startsWith(API)) return nativeFetch(input,init);

  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    try{
      const response=await nativeFetch(input,{...init,signal:controller.signal});
      clearTimeout(timer);
      if(response.ok || response.status<500 || attempt===3) return response;
      lastError=new Error(`Server returned ${response.status}`);
    }catch(error){
      clearTimeout(timer);
      lastError=error;
    }
    await new Promise(resolve=>setTimeout(resolve,1500*attempt));
  }
  throw lastError||new Error('RibhuTrack server is temporarily unavailable');
};

// While RibhuTrack is open, periodically touch the API so the free Render
// service is less likely to go idle during a teaching session.
const wakeServer=()=>nativeFetch(`${API}/health`,{cache:'no-store'}).catch(()=>{});
wakeServer();
setInterval(wakeServer,10*60*1000);

function AuthGate(){
  const [mode,setMode]=useState(localStorage.getItem('rt_token')?'app':'signup');
  if(mode==='signup') return <Signup onSignIn={()=>setMode('app')} onRegistered={()=>setMode('app')}/>;
  return <App/>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AuthGate/></React.StrictMode>);
