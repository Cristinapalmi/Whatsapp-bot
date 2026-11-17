import { describe, expect, it } from "vitest";
import { distributePassPool, splitRevenue, MoneyError } from "@/domain/money/split";

describe("Divisão 50/50", () => {
  it("100 Kz → 50 Kz artista, 50 Kz plataforma", () => {
    expect(splitRevenue(10000, 0, 50)).toEqual({ netCents: 10000, artistCents: 5000, platformCents: 5000 });
  });

  it("75 Kz → 37,50 Kz para cada lado (sem perder cêntimos)", () => {
    const r = splitRevenue(7500, 0, 50);
    expect(r.artistCents).toBe(3750);
    expect(r.platformCents).toBe(3750);
  });

  it("valores ímpares: o meio cêntimo fica na plataforma e nada se perde", () => {
    const r = splitRevenue(10001, 0, 50);
    expect(r.artistCents).toBe(5000);
    expect(r.platformCents).toBe(5001);
    expect(r.artistCents + r.platformCents).toBe(10001);
  });

  it("a comissão do prestador é descontada antes da divisão", () => {
    const r = splitRevenue(10000, 300, 50); // 100 Kz com 3 Kz de comissão
    expect(r.netCents).toBe(9700);
    expect(r.artistCents).toBe(4850);
    expect(r.platformCents).toBe(4850);
  });

  it("recusa valores inválidos", () => {
    expect(() => splitRevenue(-1, 0, 50)).toThrow(MoneyError);
    expect(() => splitRevenue(100.5, 0, 50)).toThrow(MoneyError);
    expect(() => splitRevenue(100, 200, 50)).toThrow(MoneyError);
    expect(() => splitRevenue(100, 0, 101)).toThrow(MoneyError);
  });

  it("presentes seguem a mesma regra: Cuca 50, Muamba 100, Candonga 200, Grade 500", () => {
    for (const kz of [50, 100, 200, 500]) {
      const r = splitRevenue(kz * 100, 0, 50);
      expect(r.artistCents).toBe(kz * 50);
      expect(r.artistCents + r.platformCents).toBe(kz * 100);
    }
  });
});

describe("Passe semanal dividido por tempo de visualização", () => {
  it("divide proporcionalmente aos segundos vistos", () => {
    // Fundo de 150 Kz (metade de um passe de 300 Kz); A viu 2/3 do tempo, B 1/3
    const r = distributePassPool(15000, { A: 1200, B: 600 });
    expect(r.allocations).toEqual({ A: 10000, B: 5000 });
    expect(r.remainderCents).toBe(0);
    expect(r.rolloverCents).toBe(0);
  });

  it("os cêntimos do arredondamento vão para a plataforma e a soma bate certo", () => {
    const r = distributePassPool(10000, { A: 1, B: 1, C: 1 });
    expect(r.allocations).toEqual({ A: 3333, B: 3333, C: 3333 });
    expect(r.remainderCents).toBe(1);
    const total = Object.values(r.allocations).reduce((a, b) => a + b, 0) + r.remainderCents;
    expect(total).toBe(10000);
  });

  it("se ninguém viu nada, o fundo passa para a semana seguinte", () => {
    const r = distributePassPool(15000, { A: 0 });
    expect(r.allocations).toEqual({});
    expect(r.rolloverCents).toBe(15000);
  });

  it("artistas sem visualizações não recebem nada", () => {
    const r = distributePassPool(15000, { A: 300, B: 0 });
    expect(r.allocations).toEqual({ A: 15000 });
  });
});
