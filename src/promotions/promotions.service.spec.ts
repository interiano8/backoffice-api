import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      boPromotion: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.code === 'EXISTING') {
            return Promise.resolve({ id: 'p1', code: 'EXISTING' });
          }
          if (where.id === 'promo-1') {
            return Promise.resolve({
              id: 'promo-1',
              code: 'COMBO-DESAYUNO',
              name: 'Combo Desayuno',
              active: true,
              items: [],
            });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'promo-new',
            ...data,
            items: data.items.create,
          }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({
            id: where.id,
            ...data,
          }),
        ),
        delete: jest.fn().mockResolvedValue({ id: 'promo-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  describe('createPromotion', () => {
    it('should create a combo promotion', async () => {
      const res = await service.createPromotion({
        code: 'COMBO-CAFE-DONA',
        name: 'Combo Café + Dona',
        type: 'FIXED_PRICE_COMBO',
        fixedPrice: 50,
        items: [
          { productCode: 'CAFE-01', quantityRequired: 1 },
          { productCode: 'DONA-01', quantityRequired: 1 },
        ],
      });

      expect(res.code).toBe('COMBO-CAFE-DONA');
      expect(prismaMock.boPromotion.create).toHaveBeenCalled();
    });
  });

  describe('evaluateCart', () => {
    it('should apply combo discount when cart matches requirements', async () => {
      prismaMock.boPromotion.findMany.mockResolvedValueOnce([
        {
          id: 'p1',
          code: 'COMBO-CAFE-DONA',
          name: 'Combo Café + Dona',
          type: 'FIXED_PRICE_COMBO',
          fixedPrice: 50,
          items: [
            { productCode: 'CAFE-01', quantityRequired: 1 },
            { productCode: 'DONA-01', quantityRequired: 1 },
          ],
        },
      ]);

      const cart = {
        items: [
          { productCode: 'CAFE-01', quantity: 1, unitPrice: 35 },
          { productCode: 'DONA-01', quantity: 1, unitPrice: 25 },
        ],
      };

      const result = await service.evaluateCart(cart);

      expect(result.originalSubtotal).toBe(60); // 35 + 25
      expect(result.totalDiscount).toBe(10); // 60 - 50
      expect(result.finalTotal).toBe(50);
      expect(result.appliedPromotions).toHaveLength(1);
      expect(result.appliedPromotions[0].promotionCode).toBe('COMBO-CAFE-DONA');
    });

    it('should apply percentage discount when matching items are in cart', async () => {
      prismaMock.boPromotion.findMany.mockResolvedValueOnce([
        {
          id: 'p2',
          code: 'PROMO-SNACKS-20',
          name: '20% off en Snacks',
          type: 'PERCENT_DISCOUNT',
          discountPct: 20,
          items: [{ productCode: 'CHIPS-01', quantityRequired: 1 }],
        },
      ]);

      const cart = {
        items: [
          { productCode: 'CHIPS-01', quantity: 2, unitPrice: 20 }, // 40
        ],
      };

      const result = await service.evaluateCart(cart);

      expect(result.originalSubtotal).toBe(40);
      expect(result.totalDiscount).toBe(8); // 20% of 40 = 8
      expect(result.finalTotal).toBe(32);
    });
  });
});
