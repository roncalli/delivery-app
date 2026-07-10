/**
 * Horários de funcionamento da loja (campo JSON `openingHours` no schema).
 * Formato: [{ day: 0-6 (0 = domingo), open: "18:00", close: "23:30" }]
 * Intervalos onde close <= open cruzam a meia-noite (ex.: 18:00–01:00).
 *
 * Funções puras — sem I/O — para facilitar teste isolado.
 * TODO multi-fuso: hoje usa o horário local do servidor (ok para uma região).
 */

export interface OpeningInterval {
  day: number;
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isOpenAt(hours: OpeningInterval[] | null | undefined, now: Date): boolean {
  if (!hours || hours.length === 0) return false;
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const interval of hours) {
    const open = toMinutes(interval.open);
    const close = toMinutes(interval.close);

    if (close > open) {
      // intervalo normal no mesmo dia
      if (interval.day === day && minutes >= open && minutes < close) return true;
    } else {
      // cruza a meia-noite: vale do open até 23:59 do dia, e de 00:00 até o
      // close do dia SEGUINTE
      if (interval.day === day && minutes >= open) return true;
      if ((interval.day + 1) % 7 === day && minutes < close) return true;
    }
  }
  return false;
}
