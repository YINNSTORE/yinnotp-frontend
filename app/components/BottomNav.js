"use client";
import { Home, Wallet, ShoppingBag, Activity, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 h-20 flex justify-around items-center px-4 pb-2 z-50 rounded-t-[30px] shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
      <Link href="/dashboard" className={`flex flex-col items-center gap-1 ${pathname === '/dashboard' ? 'text-slate-900' : 'text-slate-400'}`}>
        <Home size={22} />
        <span className="text-[10px] font-bold">Home</span>
      </Link>
      <Link href="/deposit" className="flex flex-col items-center gap-1 text-slate-400">
        <Wallet size={22} />
        <span className="text-[10px] font-bold">Deposit</span>
      </Link>
      
      <div className="relative -mt-12">
        <Link href="/otp" className="bg-blue-600 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 border-[5px] border-[#F3F6F9]">
          <ShoppingBag size={24} />
        </Link>
      </div>

      <Link href="/activity" className="flex flex-col items-center gap-1 text-slate-400">
        <Activity size={22} />
        <span className="text-[10px] font-bold">Activity</span>
      </Link>
      <Link href="/profile" className="flex flex-col items-center gap-1 text-slate-400">
        <User size={22} />
        <span className="text-[10px] font-bold">Profile</span>
      </Link>
    </nav>
  );
}
