"use client"
import { useEffect, useState } from "react"

export default function Order(){

  const [serviceId, setServiceId] = useState("14")
  const [country, setCountry] = useState("")
  const [providerId, setProviderId] = useState("")
  const [operatorId, setOperatorId] = useState("1")

  const [countries, setCountries] = useState([])
  const [operators, setOperators] = useState([])
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState(null)
  const [err, setErr] = useState("")

  async function loadCountries(){
    const r = await fetch(`/api/rumahotp/countries?service_id=${encodeURIComponent(serviceId)}`).then(x=>x.json()).catch(()=>null)
    if(r?.success) setCountries(r.data || [])
  }

  async function loadOperators(){
    setErr("")
    if(!country || !providerId){
      setErr("Isi country & provider_id dulu")
      return
    }
    const r = await fetch(`/api/rumahotp/operators?country=${encodeURIComponent(country)}&provider_id=${encodeURIComponent(providerId)}`).then(x=>x.json()).catch(()=>null)
    if(r?.status === true) setOperators(r.data || [])
    else setErr("Gagal ambil operator")
  }

  async function buyNumber(){
    setErr("")
    setResult(null)
    const number_id = getNumberIdFromCountry(country, countries)
    if(!number_id) return setErr("country tidak ditemukan di list countries")
    const r = await fetch(`/api/rumahotp/orders?number_id=${encodeURIComponent(number_id)}&provider_id=${encodeURIComponent(providerId)}&operator_id=${encodeURIComponent(operatorId)}`).then(x=>x.json()).catch(()=>null)
    if(r?.success) setResult(r.data)
    else setErr("Gagal order (cek provider/operator)")
  }

  async function checkStatus(){
    if(!result?.order_id) return
    const r = await fetch(`/api/rumahotp/order_status?order_id=${encodeURIComponent(result.order_id)}`).then(x=>x.json()).catch(()=>null)
    if(r?.success) setStatus(r.data)
  }

  async function setDone(){
    if(!result?.order_id) return
    await fetch(`/api/rumahotp/set_status?order_id=${encodeURIComponent(result.order_id)}&status=done`).then(x=>x.json()).catch(()=>null)
    await checkStatus()
  }

  async function setCancel(){
    if(!result?.order_id) return
    await fetch(`/api/rumahotp/set_status?order_id=${encodeURIComponent(result.order_id)}&status=cancel`).then(x=>x.json()).catch(()=>null)
    await checkStatus()
  }

  async function setResend(){
    if(!result?.order_id) return
    await fetch(`/api/rumahotp/set_status?order_id=${encodeURIComponent(result.order_id)}&status=resend`).then(x=>x.json()).catch(()=>null)
    await checkStatus()
  }

  useEffect(()=>{ loadCountries() }, [])
  useEffect(()=>{ loadCountries() }, [serviceId])

  return (
    <div style={{padding:"22px", maxWidth:1100, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
        <div>
          <div style={{fontSize:12, opacity:.7}}>YinnOTP</div>
          <div style={{fontSize:26, fontWeight:900, marginTop:6}}>Order Number</div>
          <div style={{fontSize:13, opacity:.75, marginTop:6}}>Flow: countries → operators → orders → get_status / set_status</div>
        </div>
        <a href="/" style={btn()}>Back</a>
      </div>

      <div style={{marginTop:14, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12}}>
        <div style={card()}>
          <div style={label()}>SERVICE ID</div>
          <input value={serviceId} onChange={(e)=>setServiceId(e.target.value)} style={input()} />
          <div style={hint()}>contoh: 14</div>
        </div>

        <div style={card()}>
          <div style={label()}>COUNTRY NAME</div>
          <input value={country} onChange={(e)=>setCountry(e.target.value)} style={input()} placeholder="contoh: Indonesia" />
          <div style={hint()}>harus sama seperti field name di countries</div>
        </div>

        <div style={card()}>
          <div style={label()}>PROVIDER ID</div>
          <input value={providerId} onChange={(e)=>setProviderId(e.target.value)} style={input()} placeholder="contoh: 3837" />
          <div style={hint()}>ambil dari pricelist[].provider_id</div>
        </div>

        <div style={card()}>
          <div style={label()}>OPERATOR ID</div>
          <input value={operatorId} onChange={(e)=>setOperatorId(e.target.value)} style={input()} placeholder="contoh: 1" />
          <div style={hint()}>ambil dari /operators result</div>
        </div>
      </div>

      <div style={{marginTop:12, display:"flex", gap:10, flexWrap:"wrap"}}>
        <button onClick={loadCountries} style={btnPrimary()}>Reload Countries</button>
        <button onClick={loadOperators} style={btn()}>Load Operators</button>
        <button onClick={buyNumber} style={btnPrimary()}>BUY NUMBER</button>
        <button onClick={checkStatus} style={btn()}>GET STATUS</button>
      </div>

      {!!err && <div style={{marginTop:12, background:"#3b0820", border:"1px solid #7f1d1d", padding:12, borderRadius:12}}>{err}</div>}

      <div style={{marginTop:12, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:12}}>
        <div style={card()}>
          <div style={{fontWeight:900}}>Operators</div>
          <div style={{marginTop:10, display:"grid", gap:8}}>
            {operators.map(op => (
              <div key={op.id} style={{background:"#071022", border:"1px solid #1f2937", borderRadius:12, padding:10, display:"flex", alignItems:"center", gap:10}}>
                <img src={op.image} width="22" height="22" style={{borderRadius:6}} />
                <div style={{fontSize:13, fontWeight:900}}>ID {op.id}</div>
                <div style={{fontSize:13, opacity:.75}}>{op.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card()}>
          <div style={{fontWeight:900}}>Order Result</div>
          <pre style={pre()}>{result ? JSON.stringify(result, null, 2) : "-"}</pre>
          {result?.order_id && (
            <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
              <button onClick={setDone} style={btnPrimary()}>SET DONE</button>
              <button onClick={setResend} style={btn()}>SET RESEND</button>
              <button onClick={setCancel} style={btnDanger()}>SET CANCEL</button>
            </div>
          )}
        </div>

        <div style={card()}>
          <div style={{fontWeight:900}}>Status</div>
          <pre style={pre()}>{status ? JSON.stringify(status, null, 2) : "-"}</pre>
        </div>
      </div>
    </div>
  )
}

function getNumberIdFromCountry(countryName, countries){
  const c = (countries || []).find(x => String(x.name||"").toLowerCase() === String(countryName||"").toLowerCase())
  return c ? c.number_id : null
}

function card(){ return {background:"#0f172a", border:"1px solid #1f2937", borderRadius:14, padding:14} }
function label(){ return {fontSize:12, opacity:.75, fontWeight:900} }
function hint(){ return {fontSize:12, opacity:.6, marginTop:8} }
function input(){ return {marginTop:10, width:"100%", padding:"12px 12px", borderRadius:12, outline:"none", border:"1px solid #1f2937", background:"#071022", color:"#fff"} }
function btn(){ return {padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#0f172a", color:"#fff", fontSize:13, fontWeight:900, cursor:"pointer", textDecoration:"none"} }
function btnPrimary(){ return {padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#f59e0b", color:"#111827", fontSize:13, fontWeight:900, cursor:"pointer"} }
function btnDanger(){ return {padding:"10px 12px", borderRadius:12, border:"1px solid #7f1d1d", background:"#3b0820", color:"#fff", fontSize:13, fontWeight:900, cursor:"pointer"} }
function pre(){ return {marginTop:10, background:"#071022", border:"1px solid #1f2937", borderRadius:12, padding:12, overflow:"auto", fontSize:12, minHeight:220} }
