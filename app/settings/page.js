export default function Settings(){
  return (
    <div style={{padding:"22px", maxWidth:900, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
        <div>
          <div style={{fontSize:12, opacity:.7}}>YinnOTP</div>
          <div style={{fontSize:26, fontWeight:900, marginTop:6}}>Settings</div>
          <div style={{fontSize:13, opacity:.75, marginTop:6}}>config API key ada di backend .env</div>
        </div>
        <a href="/" style={{
          textDecoration:"none", padding:"10px 12px", borderRadius:12,
          border:"1px solid #1f2937", background:"#0f172a", color:"#fff", fontSize:13, fontWeight:900
        }}>Back</a>
      </div>

      <div style={{marginTop:14, background:"#0f172a", border:"1px solid #1f2937", borderRadius:14, padding:14}}>
        <div style={{fontWeight:900}}>Edit env:</div>
        <div style={{marginTop:8, opacity:.75, fontSize:13}}>/root/yinnotp/backend/.env</div>
        <div style={{marginTop:10, opacity:.75, fontSize:13}}>Restart:</div>
        <div style={{marginTop:8, opacity:1, fontSize:13, fontWeight:900}}>pm2 restart yinnotp-backend && pm2 save</div>
      </div>
    </div>
  )
}
