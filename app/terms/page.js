import Link from "next/link"
import s from "./page.module.css"

export const metadata = { title: "Terms - YinnOTP" }

export default function TermsPage() {
  return (
    <div className={s.wrapper}>
      <div className={`${s.dots} ${s.dotsTR}`} />
      <div className={`${s.dots} ${s.dotsBL}`} />

      <main className={s.card}>
        <div className={s.header}>
          <div className={s.badge}>📜</div>
          <div>
            <h1 className={s.title}>Terms</h1>
            <p className={s.sub}>Syarat & ketentuan penggunaan layanan YinnOTP.</p>
          </div>
        </div>

        <section className={s.section}>
          <h2 className={s.h}>1. Penggunaan Layanan</h2>
          <ul className={s.ul}>
            <li className={s.li}>Gunakan layanan sesuai hukum dan kebijakan yang berlaku.</li>
            <li className={s.li}>Dilarang melakukan spam, abuse, atau aktivitas yang mengganggu sistem.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>2. Akun & Keamanan</h2>
          <ul className={s.ul}>
            <li className={s.li}>Kamu bertanggung jawab menjaga kredensial akun.</li>
            <li className={s.li}>Aktivitas yang terjadi dari akunmu dianggap sebagai tindakanmu.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>3. Pembayaran & Layanan</h2>
          <ul className={s.ul}>
            <li className={s.li}>Harga/fitur dapat berubah mengikuti kebijakan layanan.</li>
            <li className={s.li}>Gangguan sementara bisa terjadi saat maintenance atau overload.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>4. Batasan Tanggung Jawab</h2>
          <p className={s.p}>Kami berupaya menjaga layanan tetap stabil, namun tidak menjamin layanan selalu tersedia tanpa kendala. Kerugian akibat penggunaan yang tidak sesuai menjadi tanggung jawab pengguna.</p>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>5. Perubahan Terms</h2>
          <p className={s.p}>Terms ini dapat diperbarui sewaktu-waktu. Versi terbaru akan selalu tersedia di halaman ini.</p>
        </section>

        <div className={s.footer}>
          <Link className={s.link} href="/privacy">Baca Privacy</Link>
          <Link className={s.link} href="/">Kembali ke Home</Link>
        </div>
      </main>
    </div>
  )
}
