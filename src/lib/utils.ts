import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function terbilang(nilai: number): string {
  const bilangan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
  ];
  
  let hasil = "";
  if (nilai < 12) hasil = bilangan[nilai];
  else if (nilai < 20) hasil = terbilang(nilai - 10) + " Belas";
  else if (nilai < 100) hasil = terbilang(Math.floor(nilai / 10)) + " Puluh " + terbilang(nilai % 10);
  else if (nilai < 200) hasil = "Seratus " + terbilang(nilai - 100);
  else if (nilai < 1000) hasil = terbilang(Math.floor(nilai / 100)) + " Ratus " + terbilang(nilai % 100);
  else if (nilai < 2000) hasil = "Seribu " + terbilang(nilai - 1000);
  else if (nilai < 1000000) hasil = terbilang(Math.floor(nilai / 1000)) + " Ribu " + terbilang(nilai % 1000);
  else if (nilai < 1000000000) hasil = terbilang(Math.floor(nilai / 1000000)) + " Juta " + terbilang(nilai % 1000000);
  else if (nilai < 1000000000000) hasil = terbilang(Math.floor(nilai / 1000000000)) + " Miliar " + terbilang(nilai % 1000000000);
  
  return hasil.trim().replace(/\s+/g, ' ');
}
