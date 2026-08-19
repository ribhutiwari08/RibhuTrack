import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import Signup from './Signup.jsx';
import './styles.css';

function AuthGate(){
  const [mode,setMode]=useState(localStorage.getItem('rt_token')?'app':'signup');
  if(mode==='signup') return <Signup onSignIn={()=>setMode('app')} onRegistered={()=>setMode('app')}/>;
  return <App/>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AuthGate/></React.StrictMode>);
