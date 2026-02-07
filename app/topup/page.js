"use client"
import { useEffect, useState } from "react"

function money(n){ return "Rp" + Number(n||0).toLocaleString("id-ID") }

export default function Topup(){

  const [userId, setUserId] = useState("")
  const [amount, setAmount] = useState(10000)
  const [resp, setResp] = useState(null)
  const [err, setErr] = useState("")
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("yinnotp_user_id") || ""
    if(saved) setUserId(saved)
  }, [])

  async function createTopup(){
    setErr("")
    setResp(null)
    const r = await fetch("/api/pakasir/topup/create", {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ user_id: userId, amount: Number(amount) })
    }).then(x=>x.json()).catch(e=>({success:false,error:String(e)}))
    if(!r.success) setErr(r.error || "error")
    else setResp(r)
  }

  async function checkStatus(){
    if(!resp?.order_id) return
    setChecking(true)
    const r = await fetch(`/api/pakasir/topup/detail?order_id=${encodeURIComponent(resp.order_id)}`).then(x=>x.json()).catch(()=>null)
    setChecking(false)
    if(r?.success) setResp(prev => ({...prev, detail:r}))
  }

  const pay = resp?.payment || {}
  const qr = pay.payment_number || ""
  const total = pay.total_payment || pay.amount || 0

  return (
    <div style={{padding:"22px", maxWidth:900, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
        <div>
          <div style={{fontSize:12, opacity:.7}}>YinnOTP</div>
          <div style={{fontSize:26, fontWeight:900, marginTop:6}}>Deposit (Pakasir)</div>
          <div style={{fontSize:13, opacity:.75, marginTop:6}}>Create QRIS via API + webhook credit saldo local</div>
        </div>
        <a href="/" style={btn()}>Back</a>
      </div>

      <div style={{marginTop:14, display:"grid", gap:12}}>
        <div style={card()}>
          <div style={{fontSize:12, opacity:.75, fontWeight:900}}>USER ID</div>
          <input value={userId} onChange={(e)=>setUserId(e.target.value)} placeholder="contoh: yinnprovpn" style={input()} />
          <div style={{fontSize:12, opacity:.6, marginTop:8}}>harus sama seperti di Home</div>
        </div>

        <div style={card()}>
          <div style={{fontSize:12, opacity:.75, fontWeight:900}}>NOMINAL</div>
          <input value={amount} onChange={(e)=>setAmount(e.target.value)} type="number" min="1000" style={input()} />
          <div style={{display:"flex", gap:10, marginTop:10, flexWrap:"wrap"}}>
            <button onClick={createTopup} style={btnPrimary()}>Create QRIS</button>
            <button onClick={checkStatus} style={btn()}>{checking ? "Checking..." : "Check Status"}</button>
          </div>
          {!!err && <div style={{marginTop:10, background:"#3b0820", border:"1px solid #7f1d1d", padding:10, borderRadius:12}}>{err}</div>}
        </div>

        {resp?.success && (
          <div style={card()}>
            <div style={{fontWeight:900}}>ORDER ID: {resp.order_id}</div>
            <div style={{marginTop:8, fontSize:13, opacity:.8}}>TOTAL PAYMENT: <b style={{opacity:1}}>{money(total)}</b></div>
            <div style={{marginTop:8, fontSize:12, opacity:.7}}>expired_at: {pay.expired_at || "-"}</div>

            <div style={{marginTop:12, fontSize:12, fontWeight:900, opacity:.85}}>QR STRING (payment_number):</div>
            <textarea value={qr} readOnly style={textarea()} />

            <div style={{marginTop:12, fontSize:12, opacity:.7}}>
              Set webhook Pakasir ke: <b style={{opacity:1}}>/api/pakasir/webhook</b>
            </div>

            {resp?.detail?.transaction && (
              <div style={{marginTop:12, background:"#071022", border:"1px solid #1f2937", borderRadius:12, padding:12}}>
                <div style={{fontWeight:900}}>Pakasir Status: {resp.detail.transaction.status}</div>
                <div style={{fontSize:12, opacity:.75, marginTop:6}}>payment_method: {resp.detail.transaction.payment_method}</div>
                <div style={{fontSize:12, opacity:.75, marginTop:6}}>completed_at: {resp.detail.transaction.completed_at || "-"}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function card(){ return {background:"#0f172a", border:"1px solid #1f2937", borderRadius:14, padding:14} }
function input(){ return {marginTop:10, width:"100%", padding:"12px 12px", borderRadius:12, outline:"none", border:"1px solid #1f2937", background:"#071022", color:"#fff"} }
function textarea(){ return {marginTop:10, width:"100%", minHeight:140, padding:"12px 12px", borderRadius:12, outline:"none", border:"1px solid #1f2937", background:"#071022", color:"#fff"} }
function btn(){ return {padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#0f172a", color:"#fff", fontSize:13, fontWeight:900, cursor:"pointer", textDecoration:"none"} }
function btnPrimary(){ return {padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#f59e0b", color:"#111827", fontSize:13, fontWeight:900, cursor:"pointer"} }
