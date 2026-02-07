import Link from "next/link"
import s from "./page.module.css"

export const metadata = { title: "Privacy Policy - YinnOTP" }

export default function PrivacyPage() {
  return (
    <div className={s.wrapper}>
      <div className={`${s.dots} ${s.dotsTR}`} />
      <div className={`${s.dots} ${s.dotsBL}`} />

      <main className={s.card}>
        <div className={s.header}>
          <div className={s.badge}>🔒</div>
          <div>
            <h1 className={s.title}>Privacy Policy</h1>
            <p className={s.sub}>Kebijakan privasi untuk layanan YinnOTP.</p>
          </div>
        </div>

        <section className={s.section}>
          <h2 className={s.h}>1. Informasi yang Kami Kumpulkan</h2>
          <ul className={s.ul}>
            <li className={s.li}><b>Data akun:</b> username, email, dan data autentikasi (mis. OAuth) untuk login.</li>
            <li className={s.li}><b>Data transaksi:</b> riwayat order, status pembayaran, dan data yang diperlukan untuk proses layanan.</li>
            <li className={s.li}><b>Data teknis:</b> log akses dasar (IP, user-agent, timestamp) untuk keamanan & pencegahan abuse.</li>
            <li className={s.li}><b>Cookies:</b> untuk menjaga sesi login dan preferensi dasar.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>2. Cara Kami Menggunakan Data</h2>
          <ul className={s.ul}>
            <li className={s.li}>Menyediakan fitur login, dashboard, dan layanan yang kamu gunakan.</li>
            <li className={s.li}>Memproses transaksi dan menampilkan status pembayaran.</li>
            <li className={s.li}>Meningkatkan keamanan (anti-fraud, rate limit, audit log).</li>
            <li className={s.li}>Peningkatan performa dan stabilitas sistem.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>3. Berbagi Data</h2>
          <p className={s.p}>Kami tidak menjual data pribadi. Data dapat dibagikan hanya bila diperlukan untuk:</p>
          <ul className={s.ul}>
            <li className={s.li}><b>Penyedia autentikasi (Google/GitHub)</b> saat kamu login via OAuth.</li>
            <li className={s.li}><b>Penyedia pembayaran</b> jika kamu menggunakan metode pembayaran tertentu.</li>
            <li className={s.li}><b>Kepatuhan hukum</b> bila diwajibkan oleh peraturan yang berlaku.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>4. Keamanan</h2>
          <p className={s.p}>Kami menerapkan langkah-langkah keamanan yang wajar (validasi input, kontrol akses, dan proteksi sesi). Namun, tidak ada sistem yang 100% bebas risiko.</p>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>5. Retensi Data</h2>
          <p className={s.p}>Data disimpan selama akun kamu aktif atau selama diperlukan untuk operasional dan kepatuhan. Kamu dapat meminta penghapusan akun sesuai kebijakan dan ketentuan yang berlaku.</p>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>6. Hak Pengguna</h2>
          <ul className={s.ul}>
            <li className={s.li}>Memperbarui informasi akun (jika fitur tersedia).</li>
            <li className={s.li}>Meminta penghapusan akun/data tertentu (sesuai ketentuan).</li>
            <li className={s.li}>Menolak cookies non-esensial jika diimplementasikan.</li>
          </ul>
        </section>

        <section className={s.section}>
          <h2 className={s.h}>7. Perubahan Kebijakan</h2>
          <p className={s.p}>Kebijakan ini bisa diperbarui sewaktu-waktu. Versi terbaru akan selalu tersedia di halaman ini.</p>
        </section>

        <div className={s.footer}>
          <Link className={s.link} href="/terms">Baca Terms</Link>
          <Link className={s.link} href="/">Kembali ke Home</Link>
        </div>
      </main>
    </div>
  )
}
