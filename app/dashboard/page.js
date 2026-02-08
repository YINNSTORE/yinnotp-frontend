"use client";
import React from 'react';
import { Sun, User as UserIcon, Wallet, ChevronRight, PlusCircle, RotateCw, Plus, Headphones, HelpCircle, ChevronDown } from 'lucide-react';
import BottomNav from '../components/BottomNav'; // Path disesuaikan ke folder components

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#F3F6F9] pb-24 text-slate-900">
      <div className="max-w-md mx-auto p-4">
        
        {/* Header Profile */}
        <header className="flex justify-between items-center mb-6 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">Y</div>
            <div>
              <h4 className="text-[15px] font-extrabold leading-tight">yinnzzmc</h4>
              <p className="text-[11px] text-slate-500">Selamat malam 💤</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 bg-white rounded-xl shadow-sm border border-gray-50"><Sun size={18} className="text-slate-400" /></button>
            <button className="p-2 bg-white rounded-xl shadow-sm border border-gray-50"><UserIcon size={18} className="text-slate-400" /></button>
          </div>
        </header>

        {/* Balance & Promo Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white p-4 rounded-[25px] shadow-sm border border-white">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mb-1">
              <Wallet size={12} /> Saldo Kamu
            </div>
            <h2 className="text-lg font-black mb-3 text-slate-800">1.000 IDR</h2>
            <button className="w-full bg-emerald-50 text-emerald-500 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-100 transition-colors">
              <PlusCircle size={14} /> Top Up
            </button>
          </div>
          
          <div className="bg-gradient-to-br from-orange-400 via-amber-400 to-emerald-400 p-4 rounded-[25px] text-white relative shadow-md">
            <h5 className="text-[13px] font-black leading-tight mb-1">Get Virtual Number</h5>
            <p className="text-[9px] opacity-90 leading-tight mb-3">OTP access for 1,038+ apps across 193 countries</p>
            <div className="flex items-center gap-1 pt-1">
              <span className="text-[10px] font-black">Beli Nomor</span>
              <ChevronRight size={10} strokeWidth={3} />
            </div>
          </div>
        </div>

        {/* Server Status Pill */}
        <div className="flex gap-2 mb-6">
          <div className="bg-white px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shadow-sm text-emerald-500 border border-white">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Online
          </div>
          <div className="bg-white px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-sm text-slate-400 border border-white">
             <span className="text-emerald-500 font-extrabold">235ms</span> response server
          </div>
        </div>

        {/* Pending Orders Section */}
        <div className="bg-white rounded-[30px] p-6 mb-5 shadow-sm border border-white">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-extrabold text-[15px]">Pesanan Pending</h3>
            <button className="p-1.5 bg-slate-50 rounded-lg text-slate-400"><RotateCw size={14} /></button>
          </div>
          <div className="flex flex-col items-center text-center py-4">
            <img src="https://cdn-icons-png.flaticon.com/512/2362/2362252.png" className="w-24 mb-4 opacity-80" alt="empty" />
            <h4 className="font-bold text-[14px] mb-1 text-slate-800">Tidak ada pesanan</h4>
            <p className="text-[11px] text-slate-400 mb-5">Pesanan aktif akan muncul disini</p>
            <button className="bg-slate-900 text-white px-8 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-slate-200">
              <Plus size={16} /> Buat Pesanan
            </button>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-[30px] p-6 shadow-sm border border-white">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-blue-50 rounded-xl"><Headphones size={18} className="text-blue-600" /></div>
            <h3 className="font-extrabold text-[15px]">Pertanyaan Umum</h3>
          </div>
          
          <div className="space-y-3">
            {["Ayo belajar membaca!", "OTP gak masuk masuk", "Syarat refund"].map((text, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-[#F8FAFC] rounded-2xl border border-slate-50 active:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3 text-[12px] font-bold text-slate-700">
                  <HelpCircle size={16} className="text-orange-400" /> {text}
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
