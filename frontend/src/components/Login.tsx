import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";



function Login() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setPassword] = useState('');
  async function doLogin(event: any): Promise<void> {
    event.preventDefault();
    var obj = { login: loginName, password: loginPassword };
    var js = JSON.stringify(obj);
    try {
      const response = await fetch('http://localhost:5001/api/login',
        { method: 'POST', body: js, headers: { 'Content-Type': 'application/json' } });
      var res = JSON.parse(await response.text());
      if (res.id <= 0) {
        setMessage('User/Password combination incorrect');
      }
      else {
        var user = { firstName: res.firstName, lastName: res.lastName, id: res.id }
        localStorage.setItem('user_data', JSON.stringify(user));
        setMessage('');
        window.location.href = '/cards';
      }
    }
    catch (error: any) {
      alert(error.toString());
      return;
    }
  };

  function handleSetLoginName(e: any): void {
    setLoginName(e.target.value);
  }
  function handleSetPassword(e: any): void {
    setPassword(e.target.value);
  }
  return (
    <div id="loginDiv">
      <span id="inner-title">PLEASE LOG IN</span><br />
      Login: <input type="text" id="loginName" placeholder="Username"
        onChange={handleSetLoginName} />
      Password: <input type="password" id="loginPassword" placeholder="Password"
        onChange={handleSetPassword} />
      <input type="submit" id="loginButton" className="buttons" value="Do It"
        onClick={doLogin} />
      <span id="loginResult">{message}</span>
    </div>
  );
};
export default Login;
