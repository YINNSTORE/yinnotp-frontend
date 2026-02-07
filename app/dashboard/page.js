"use client"
import { useEffect, useState } from "react"

export default function Dashboard() {

  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState("14")
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(false)

  async function loadServices(){
    const r = await fetch("/api/rumahotp/services").then(x=>x.json()).catch(()=>null)
    if(r?.success) setServices(r.data || [])
  }

  async function loadCountries(){
    setLoading(true)
    const r = await fetch(`/api/rumahotp/countries?service_id=${encodeURIComponent(serviceId)}`).then(x=>x.json()).catch(()=>null)
    if(r?.success) setCountries(r.data || [])
    setLoading(false)
  }

  useEffect(()=>{ loadServices(); loadCountries() }, [])
  useEffect(()=>{ loadCountries() }, [serviceId])

  return (
    <div style={{padding:"22px", maxWidth:1100, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
        <div>
          <div style={{fontSize:12, opacity:.7}}>YinnOTP</div>
          <div style={{fontSize:26, fontWeight:900, marginTop:6}}>Negara (Countries V2)</div>
          <div style={{fontSize:13, opacity:.75, marginTop:6}}>service_id wajib (sesuai docs)</div>
        </div>
        <a href="/" style={btn()}>Back</a>
      </div>

      <div style={{marginTop:14, display:"flex", gap:10, flexWrap:"wrap"}}>
        <select value={serviceId} onChange={(e)=>setServiceId(e.target.value)} style={select()}>
          <option value="14">Service ID 14 (default)</option>
          {services.map(s => (
            <option key={s.service_code} value={String(s.service_code)}>
              {s.service_name} (ID {s.service_code})
            </option>
          ))}
        </select>

        <button onClick={loadCountries} style={btnPrimary()}>{loading ? "Loading..." : "Refresh"}</button>
      </div>

      <div style={{marginTop:14, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12}}>
        {countries.map(c => (
          <div key={c.number_id} style={card()}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <img src={c.img} width="38" height="26" style={{borderRadius:7}} />
              <div style={{fontWeight:900}}>{c.name}</div>
            </div>

            <div style={meta()}>prefix: {c.prefix} • iso: {c.iso_code}</div>
            <div style={meta()}>stock_total: {c.stock_total} • rate: {c.rate}</div>

            <div style={{marginTop:10, fontSize:12, opacity:.8, fontWeight:800}}>Pricelist</div>
            <div style={{marginTop:8, display:"grid", gap:8}}>
              {(c.pricelist || []).slice(0,3).map((p, idx) => (
                <div key={idx} style={{background:"#071022", border:"1px solid #1f2937", borderRadius:12, padding:10}}>
                  <div style={{fontSize:12, fontWeight:900}}>provider_id: {p.provider_id} • server_id: {p.server_id}</div>
                  <div style={{fontSize:12, opacity:.75, marginTop:6}}>stock: {p.stock} • rate: {p.rate} • price: {p.price_format}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function card(){ return {background:"#0f172a", border:"1px solid #1f2937", borderRadius:14, padding:14} }
function meta(){ return {fontSize:12, opacity:.75, marginTop:8} }
function select(){ return {padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#0f172a", color:"#fff", fontWeight:800} }
function btn(){ return {textDecoration:"none", padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#0f172a", color:"#fff", fontSize:13, fontWeight:900} }
function btnPrimary(){ return {padding:"10px 12px", borderRadius:12, border:"1px solid #1f2937", background:"#f59e0b", color:"#111827", fontSize:13, fontWeight:900, cursor:"pointer"} }
