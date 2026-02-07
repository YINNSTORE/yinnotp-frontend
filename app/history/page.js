"use client"
import { useEffect, useState } from "react"
function money(n){ return "Rp" + Number(n||0).toLocaleString("id-ID") }

export default function History(){
  const [userId, setUserId] = useState("")
  const [topups, setTopups] = useState([])

  useEffect(()=> {
    const saved = localStorage.getItem("yinnotp_user_id") || ""
    if(saved) setUserId(saved)
  }, [])

  async function load(){
    if(!userId) return
    const r = await fetch(`/api/user/topups?user_id=${encodeURIComponent(userId)}`).then(x=>x.json()).catch(()=>null)
    if(r?.success) setTopups(r.topups || [])
  }

  useEffect(()=>{ load() }, [userId])

  return (
    <div style={{padding:"22px", maxWidth:900, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
        <div>
          <div style={{fontSize:12, opacity:.7}}>YinnOTP</div>
          <div style={{fontSize:26, fontWeight:900, marginTop:6}}>History Deposit</div>
        </div>
        <a href="/" style={btn()}>Back</a>
      </div>

      <div style={{marginTop:14, background:"#0f172a", border:"1px solid #1f2937", borderRadius:14, padding:14}}>
        <div style={{fontSize:12, opacity:.75, fontWeight:900}}>USER ID</div>
        <input value={userId} onChange={(e)=>setUserId(e.target.value)} style={input()} placeholder="contoh: yinnprovpn" />
        <button onClick={load} style={btnPrimary()}>Reload</button>
      </div>

      <div style={{marginTop:14, display:"grid", gap:10}}>
        {topups.map(t => (
          <div key={t.order_id} style={{background:"#0f172a", border:"1px solid #1f2937", borderRadius:14, padding:14}}>
            <div style={{fontWeight:900}}>{t.order_id}</div>
            <div style={{fontSize:12, opacity:.75, marginTop:6}}>amount: {money(t.amount)} • status: <b style={{opacity:1}}>{t.status}</b></div>
          </div>
        ))}
        {!topups.length && <div style={{opacity:.7, marginTop:8}}>belum ada data</div>}
      </div>
    </div>
  )
}

function input(){ return {marginTop:10, width:"100%", padding:"12px 12px", borderRadius:12, outline:"none", border:"1px solid #1f2937", background:"#071022", color:"#fff"} }
function btn(){ return {textDecoration:"none", padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#0f172a", color:"#fff", fontSize:13, fontWeight:900} }
function btnPrimary(){ return {marginTop:10, padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#f59e0b", color:"#111827", fontSize:13, fontWeight:900, cursor:"pointer"} }
