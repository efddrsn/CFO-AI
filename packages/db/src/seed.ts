import "dotenv/config";
import { db } from "./index.js";
import { categories } from "./schema/categories.js";

/**
 * Taxonomia inicial — §6.1 da SPEC.
 * Roda 1× após `migrate`. Idempotente (skip se já existe categoria com mesmo nome+kind+parent).
 */
type SeedNode = {
  name: string;
  kind: "income" | "expense" | "transfer" | "investment";
  children?: string[];
};

const taxonomy: SeedNode[] = [
  {
    name: "Renda",
    kind: "income",
    children: [
      "Salário",
      "Pró-labore / PJ",
      "Investimentos (juros/dividendos)",
      "Aluguel recebido",
      "Reembolsos",
      "Outros",
    ],
  },
  {
    name: "Moradia",
    kind: "expense",
    children: [
      "Aluguel / financiamento",
      "Condomínio",
      "IPTU",
      "Energia / Água / Gás",
      "Internet",
      "Manutenção / Reformas",
      "Mobiliário",
    ],
  },
  {
    name: "Alimentação",
    kind: "expense",
    children: ["Mercado", "Restaurante", "Delivery", "Cafeteria / bebidas"],
  },
  {
    name: "Transporte",
    kind: "expense",
    children: [
      "Combustível",
      "Estacionamento / pedágio",
      "Uber / táxi",
      "Transporte público",
      "Manutenção do carro",
      "IPVA / seguro",
    ],
  },
  {
    name: "Saúde",
    kind: "expense",
    children: ["Plano de saúde", "Consultas", "Farmácia", "Academia", "Terapia"],
  },
  {
    name: "Educação",
    kind: "expense",
    children: ["Cursos", "Livros", "Assinaturas educacionais"],
  },
  {
    name: "Lazer",
    kind: "expense",
    children: [
      "Streaming / assinaturas",
      "Viagens",
      "Bares / eventos",
      "Hobbies",
      "Jogos",
    ],
  },
  {
    name: "Compras pessoais",
    kind: "expense",
    children: ["Vestuário", "Eletrônicos", "Beleza", "Presentes"],
  },
  { name: "Pets", kind: "expense", children: ["Ração / vet / pet shop"] },
  { name: "Família / Filhos", kind: "expense", children: [] },
  { name: "Impostos", kind: "expense", children: ["IRPF", "Outros"] },
  {
    name: "Tarifas financeiras",
    kind: "expense",
    children: ["Tarifas bancárias", "Juros pagos", "Spread câmbio"],
  },
  {
    name: "Investimentos",
    kind: "investment",
    children: [
      "Aporte renda fixa BR",
      "Aporte renda variável BR",
      "Aporte cripto",
      "Aporte US (brokerage)",
      "Resgate",
    ],
  },
  {
    name: "Transferências internas",
    kind: "transfer",
    children: ["Entre contas próprias (BR↔US, etc.)", "Pagamento de cartão"],
  },
  { name: "Não categorizado", kind: "expense", children: [] },
];

async function main() {
  console.log("Seeding taxonomy...");

  for (const node of taxonomy) {
    const [parent] = await db
      .insert(categories)
      .values({ name: node.name, kind: node.kind })
      .onConflictDoNothing()
      .returning();

    // se onConflictDoNothing pulou, busca o existente
    const parentRow =
      parent ??
      (await db.query.categories.findFirst({
        where: (c, { and, eq, isNull }) =>
          and(eq(c.name, node.name), eq(c.kind, node.kind), isNull(c.parentId)),
      }));

    if (!parentRow) {
      console.warn(`Could not seed parent ${node.name}`);
      continue;
    }

    for (const childName of node.children ?? []) {
      await db
        .insert(categories)
        .values({
          name: childName,
          kind: node.kind,
          parentId: parentRow.id,
        })
        .onConflictDoNothing();
    }
  }

  console.log("Seed done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
