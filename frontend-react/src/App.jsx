import React, { useState } from 'react';
import { BrowserProvider } from 'ethers';

const buildMessage = (p) => {
  return `${p.domain} wants you to sign in with your Ethereum account:\n${p.address}\n\n${p.statement}\n\nVersion: ${p.version}\nNonce: ${p.nonce}\nIssued At: ${p.issued_at}\nExpiration Time: ${p.expiration_time}\nNot Before: ${p.invalid_before}`;
};

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState('');
  const [payload, setPayload] = useState(null);
  const [signature, setSignature] = useState('');
  const [token, setToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [log, setLog] = useState('');

  // Swap form state
  const [fromChainId, setFromChainId] = useState(1);
  const [toChainId, setToChainId] = useState(137);
  const [fromToken, setFromToken] = useState('NATIVE');
  const [toToken, setToToken] = useState('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
  const [amount, setAmount] = useState('1000000000000000000');

  // --- Service URLs (editáveis) ---
  const [urlAuth, setUrlAuth] = useState('http://localhost:3001');
  const [urlWallet, setUrlWallet] = useState('http://localhost:3000');
  const [urlSwap, setUrlSwap] = useState('http://localhost:3002');

  const appendLog = (msg) => setLog((prev) => prev + msg + '\n');

  const connect = async () => {
    if (!window.ethereum) {
      alert('MetaMask não encontrada');
      return;
    }
    const prov = new BrowserProvider(window.ethereum);
    await prov.send('eth_requestAccounts', []);
    const s = await prov.getSigner();
    setProvider(prov);
    setSigner(s);
    const addr = await s.getAddress();
    setAddress(addr);
    appendLog('Wallet conectada: ' + addr);
  };

  const authLogin = async () => {
    if (!signer) return alert('Conecte a wallet');
    const res = await fetch(urlAuth + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const data = await res.json();
    setPayload(data.payload);
    appendLog('/auth/login -> ' + JSON.stringify(data, null, 2));
  };

  const signPayload = async () => {
    if (!payload) return alert('Faça /auth/login primeiro');
    const msg = buildMessage(payload);
    const sig = await signer.signMessage(msg);
    setSignature(sig);
    appendLog('Signature: ' + sig);
  };

  const authVerify = async () => {
    if (!signature) return alert('Assine antes');
    const res = await fetch(urlAuth + '/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, signature }),
    });
    const data = await res.json();
    setToken(data.token);
    setSessionId(data.sessionId);
    appendLog('/auth/verify -> ' + JSON.stringify(data, null, 2));
  };

  const authValidate = async () => {
    if (!token) return alert('Primeiro /auth/verify');
    const res = await fetch(urlAuth + '/auth/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, sessionId }),
    });
    const data = await res.json();
    appendLog('/auth/validate -> ' + JSON.stringify(data, null, 2));
  };

  // ------- Liquid Swap call -------
  const callSwap = async () => {
    if (!token) return alert('Precisa do JWT');
    const body = { fromChainId: Number(fromChainId), toChainId: Number(toChainId), fromToken, toToken, amount };
    appendLog('Calling /swap/manual -> ' + JSON.stringify(body));
    const res = await fetch(urlSwap + '/swap/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    appendLog('/swap/manual -> ' + JSON.stringify(data, null, 2));
  };

  return (
    <div style={{ fontFamily: 'Arial', padding: 20 }}>
      <h1>PanoramaBlock Tester (React)</h1>

      <section style={{ border: '1px solid #ccc', padding: 12, marginBottom: 20 }}>
        <h2>Wallet</h2>
        <div>
          <label>
            Auth URL:
            <input value={urlAuth} onChange={(e)=>setUrlAuth(e.target.value)} style={{ width: 300, marginLeft: 6 }} />
          </label>
        </div>
        <div>
          <label>
            Wallet URL:
            <input value={urlWallet} onChange={(e)=>setUrlWallet(e.target.value)} style={{ width: 300, marginLeft: 0 }} />
          </label>
        </div>
        <div>
          <label>
            Swap URL:
            <input value={urlSwap} onChange={(e)=>setUrlSwap(e.target.value)} style={{ width: 300, marginLeft: 12 }} />
          </label>
        </div>
        <button onClick={connect}>Connect MetaMask</button>
        <div>{address && 'Conectado: ' + address}</div>
      </section>

      <section style={{ border: '1px solid #ccc', padding: 12, marginBottom: 20 }}>
        <h2>Auth Flow</h2>
        <button onClick={authLogin}>/auth/login</button>
        <button onClick={signPayload}>Assinar payload</button>
        <button onClick={authVerify}>/auth/verify</button>
        <button onClick={authValidate}>/auth/validate</button>
      </section>

      <section style={{ border: '1px solid #ccc', padding: 12, marginBottom: 20 }}>
        <h2>Liquid Swap</h2>
        <div>
          <label>
            fromChainId:
            <input value={fromChainId} onChange={(e) => setFromChainId(e.target.value)} style={{ width: 80, marginLeft: 4 }} />
          </label>
        </div>
        <div>
          <label>
            toChainId:
            <input value={toChainId} onChange={(e) => setToChainId(e.target.value)} style={{ width: 80, marginLeft: 28 }} />
          </label>
        </div>
        <div>
          <label>
            fromToken:
            <input value={fromToken} onChange={(e) => setFromToken(e.target.value)} style={{ width: 420, marginLeft: 8 }} />
          </label>
        </div>
        <div>
          <label>
            toToken:
            <input value={toToken} onChange={(e) => setToToken(e.target.value)} style={{ width: 420, marginLeft: 23 }} />
          </label>
        </div>
        <div>
          <label>
            amount (wei):
            <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 420, marginLeft: 6 }} />
          </label>
        </div>
        <button onClick={callSwap}>POST /swap/manual</button>
      </section>

      <section style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 10 }}>
        {log}
      </section>
    </div>
  );
} 