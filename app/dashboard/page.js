"use client";
import React from 'react';
import { Sun, User as UserIcon, Wallet, ChevronRight, PlusCircle, RotateCw, Plus, Headphones, HelpCircle, ChevronDown, Bell, MessageCircle, Send, Facebook } from 'lucide-react';
import BottomNav from '../components/BottomNav';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#F3F6F9] pb-32 text-slate-900 font-sans">
      <div className="max-w-md mx-auto p-4">
        
        {/* Header Section */}
        <header className="flex justify-between items-center mb-6 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-xl shadow-md border-2 border-white">Y</div>
            <div>
              <h4 className="text-[16px] font-black leading-tight text-slate-800">yinnzzmc</h4>
              <p className="text-[11px] text-slate-500 font-medium">Selamat malam 💤</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2.5 bg-white rounded-2xl shadow-sm border border-gray-50"><Sun size={18} className="text-slate-400" /></button>
            <button className="p-2.5 bg-white rounded-2xl shadow-sm border border-gray-50"><UserIcon size={18} className="text-slate-400" /></button>
          </div>
        </header>

        {/* Top Content: Saldo & Promo */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-4 rounded-[28px] shadow-sm border border-white">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mb-1 tracking-wide uppercase">
              <Wallet size={12} /> Saldo Kamu
            </div>
            <h2 className="text-xl font-black mb-3 text-slate-800 tracking-tight">1.000 IDR</h2>
            <button className="w-full bg-[#E8FBF3] text-[#10B981] py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-all">
              <PlusCircle size={14} /> Top Up
            </button>
          </div>
          
          <div className="bg-gradient-to-br from-[#FF8E53] via-[#FFB347] to-[#10B981] p-4 rounded-[28px] text-white relative shadow-lg shadow-orange-100 overflow-hidden">
            <h5 className="text-[14px] font-black leading-tight mb-1">Get Virtual Number</h5>
            <p className="text-[9px] opacity-90 leading-tight mb-3 font-medium">OTP access for 1,038+ apps across 193 countries</p>
            <div className="flex items-center gap-1.5 pt-1">
               <div className="flex -space-x-1.5">
                  <div className="bg-white/20 p-1 rounded-md"><MessageCircle size={10} /></div>
                  <div className="bg-white/20 p-1 rounded-md"><Send size={10} /></div>
                  <div className="bg-white/20 p-1 rounded-md"><Facebook size={10} /></div>
               </div>
              <span className="text-[10px] font-black ml-auto flex items-center gap-0.5">Beli Nomor <ChevronRight size={10} strokeWidth={4} /></span>
            </div>
          </div>
        </div>

        {/* Server Status */}
        <div className="flex gap-2 mb-6">
          <div className="bg-white px-4 py-2 rounded-2xl text-[10px] font-bold flex items-center gap-2 shadow-sm text-emerald-500 border border-white">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10B981]"></span> Online
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 shadow-sm text-slate-400 border border-white">
             <span className="text-emerald-500 font-black">235ms</span> response server saat ini
          </div>
        </div>

        {/* Pesanan Pending Box */}
        <div className="bg-white rounded-[35px] p-6 mb-5 shadow-sm border border-white relative overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-[16px] text-slate-800">Pesanan Pending</h3>
            <button className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"><RotateCw size={15} /></button>
          </div>
          <div className="flex flex-col items-center text-center py-6">
            <div className="relative mb-4">
               <img src="https://cdn-icons-png.flaticon.com/512/2362/2362252.png" className="w-28 drop-shadow-xl" alt="delivery-icon" />
            </div>
            <h4 className="font-black text-[15px] mb-1 text-slate-800 tracking-tight">Tidak ada pesanan</h4>
            <p className="text-[12px] text-slate-400 font-medium mb-6">Pesanan aktif akan muncul disini</p>
            <button className="bg-[#1E293B] text-white px-10 py-3.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95">
              <Plus size={18} strokeWidth={3} /> Buat Pesanan
            </button>
          </div>
        </div>

        {/* Bottom Section: Notifikasi & FAQ */}
        <div className="grid grid-cols-1 gap-4">
           {/* FAQ List */}
           <div className="bg-white rounded-[35px] p-6 shadow-sm border border-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 rounded-2xl"><Headphones size={20} className="text-blue-600" /></div>
                <div>
                  <h3 className="font-black text-[16px] text-slate-800 leading-none">Pertanyaan Umum</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Pertanyaan yang sering diajukan</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {["Ayo belajar membaca!", "OTP gak masuk masuk", "Cancel tapi saldo terpotong", "Lupa cancel active order", "Syarat refund"].map((text, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-[#F8FAFC] rounded-[20px] border border-slate-50 hover:border-slate-200 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3 text-[12px] font-bold text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-orange-400/20 flex items-center justify-center"><HelpCircle size={14} className="text-orange-400" /></div>
                      {text}
                    </div>
                    <ChevronDown size={14} className="text-slate-300 group-hover:text-slate-500" />
                  </div>
                ))}
              </div>
           </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
