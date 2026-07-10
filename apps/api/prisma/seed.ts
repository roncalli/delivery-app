// Seed de desenvolvimento: cria admin, uma cidade, um lojista com loja ativa
// e um cardápio de exemplo. Rodar com: npm run db:seed
// Senhas de DEV: admin@exemplo.dev / admin123 — ze@exemplo.dev / lojista123
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const city = await prisma.city.upsert({
    where: { name_state: { name: 'Cidade Exemplo', state: 'MG' } },
    update: {},
    create: { name: 'Cidade Exemplo', state: 'MG' },
  });

  const adminHash = bcrypt.hashSync('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { phone: '+5500000000000' },
    update: { passwordHash: adminHash },
    create: {
      role: 'ADMIN',
      name: 'Admin',
      phone: '+5500000000000',
      email: 'admin@exemplo.dev',
      passwordHash: adminHash,
    },
  });

  const ownerHash = bcrypt.hashSync('lojista123', 10);
  const owner = await prisma.user.upsert({
    where: { phone: '+5500000000001' },
    update: { passwordHash: ownerHash },
    create: {
      role: 'STORE_OWNER',
      name: 'Zé da Pizza',
      phone: '+5500000000001',
      email: 'ze@exemplo.dev',
      passwordHash: ownerHash,
    },
  });

  const store = await prisma.store.upsert({
    where: { slug: 'pizzaria-do-ze' },
    update: {},
    create: {
      cityId: city.id,
      ownerId: owner.id,
      name: 'Pizzaria do Zé',
      slug: 'pizzaria-do-ze',
      category: 'Pizza',
      document: '00000000000000',
      status: 'ACTIVE',
      deliveryMode: 'OWN',
      openingHours: [
        { day: 5, open: '18:00', close: '23:30' },
        { day: 6, open: '18:00', close: '23:30' },
        { day: 0, open: '18:00', close: '23:00' },
      ],
      deliveryZones: {
        create: [{ type: 'RADIUS', radiusKm: 5, fee: 6.0, etaMinutes: 40 }],
      },
    },
  });

  const category = await prisma.menuCategory.create({
    data: { storeId: store.id, name: 'Pizzas Tradicionais', sortOrder: 0 },
  });

  await prisma.product.create({
    data: {
      storeId: store.id,
      categoryId: category.id,
      name: 'Pizza Margherita',
      description: 'Molho de tomate, muçarela e manjericão',
      price: 39.9,
      optionGroups: {
        create: [
          {
            name: 'Tamanho',
            minSelect: 1,
            maxSelect: 1,
            options: {
              create: [
                { name: 'Média (6 fatias)', extraPrice: 0 },
                { name: 'Grande (8 fatias)', extraPrice: 12 },
              ],
            },
          },
          {
            name: 'Adicionais',
            minSelect: 0,
            maxSelect: 3,
            options: {
              create: [
                { name: 'Borda recheada', extraPrice: 8 },
                { name: 'Extra muçarela', extraPrice: 6 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.wallet.upsert({
    where: { storeId: store.id },
    update: {},
    create: { ownerType: 'STORE', storeId: store.id },
  });

  console.log('Seed concluído:', { city: city.name, admin: admin.email, store: store.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
