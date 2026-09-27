import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BrevoNotificationService } from './brevo-notification.service';

describe('BrevoNotificationService', () => {
  let service: BrevoNotificationService;
  let configServiceMock: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    configServiceMock = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrevoNotificationService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<BrevoNotificationService>(BrevoNotificationService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('debe operar en modo dry-run si no hay BREVO_API_KEY configurada', async () => {
    configServiceMock.get.mockReturnValue('');

    const result = await service.sendEmail({
      to: ['test@prisma.hn'],
      subject: 'Prueba de Alerta',
      htmlContent: '<p>Hola</p>',
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.messageId).toContain('dry-run');
  });

  it('debe rechazar el envío si la lista de destinatarios está vacía', async () => {
    configServiceMock.get.mockReturnValue('test-api-key');

    const result = await service.sendEmail({
      to: [],
      subject: 'Sin destinatarios',
      htmlContent: '<p>Contenido</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Lista de destinatarios vacía');
  });

  it('debe enviar la petición HTTP a la API v3 de Brevo con los headers y body correctos', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'BREVO_API_KEY') return 'xkeysib-valid-key-123';
      if (key === 'BREVO_SENDER_EMAIL') return 'hub@prisma.hn';
      if (key === 'BREVO_SENDER_NAME') return 'Prisma Hub';
      return null;
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({ messageId: '<brevo-msg-789@smtp>' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await service.sendEmail({
      to: ['auditor@prisma.hn', 'gerente@prisma.hn'],
      subject: '[ALERTA] Descuadre',
      htmlContent: '<h1>Descuadre detectado</h1>',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, requestInit] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers['api-key']).toBe('xkeysib-valid-key-123');

    const body = JSON.parse(requestInit.body);
    expect(body.sender).toEqual({ name: 'Prisma Hub', email: 'hub@prisma.hn' });
    expect(body.to).toEqual([
      { email: 'auditor@prisma.hn' },
      { email: 'gerente@prisma.hn' },
    ]);
    expect(body.subject).toBe('[ALERTA] Descuadre');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('<brevo-msg-789@smtp>');
  });

  it('debe manejar errores HTTP de Brevo (ej. 401 Unauthorized) sin propagar excepciones no capturadas', async () => {
    configServiceMock.get.mockReturnValue('invalid-key');

    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('Key not found in database'),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await service.sendEmail({
      to: ['admin@prisma.hn'],
      subject: 'Alerta Test',
      htmlContent: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Brevo HTTP 401: Key not found in database');
  });

  it('debe capturar errores de timeout o red de fetch devolviendo success: false', async () => {
    configServiceMock.get.mockReturnValue('valid-key');

    const mockFetch = jest.fn().mockRejectedValue(new Error('Connection timed out'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await service.sendEmail({
      to: ['admin@prisma.hn'],
      subject: 'Alerta Test',
      htmlContent: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection timed out');
  });
});
