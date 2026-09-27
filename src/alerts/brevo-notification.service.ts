import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  to: string[];
  subject: string;
  htmlContent: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

@Injectable()
export class BrevoNotificationService {
  private readonly logger = new Logger(BrevoNotificationService.name);
  private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Envía un correo electrónico transaccional consumiendo la API v3 de Brevo.
   * Si no hay API key configurada o está en modo dry-run, simula el envío sin error.
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const apiKey =
      this.configService.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY ||
      '';
    const senderEmail =
      this.configService.get<string>('BREVO_SENDER_EMAIL') ||
      process.env.BREVO_SENDER_EMAIL ||
      'alertas@estacionesprisma.hn';
    const senderName =
      this.configService.get<string>('BREVO_SENDER_NAME') ||
      process.env.BREVO_SENDER_NAME ||
      'Prisma Hub Central';

    if (!options.to || options.to.length === 0) {
      this.logger.warn(`No se enviará correo '${options.subject}': lista de destinatarios vacía.`);
      return { success: false, error: 'Lista de destinatarios vacía' };
    }

    // Modo dry-run en caso de ausencia de API Key
    if (!apiKey || apiKey === 'dry-run') {
      this.logger.log(
        `[DRY-RUN] Correo simulado: "${options.subject}" para [${options.to.join(', ')}]`,
      );
      return {
        success: true,
        messageId: `dry-run-${Date.now()}`,
        simulated: true,
      };
    }

    const payload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: options.to.map((email) => ({ email })),
      subject: options.subject,
      htmlContent: options.htmlContent,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Error en API Brevo HTTP ${response.status}: ${errorText}`,
        );
        return {
          success: false,
          error: `Brevo HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = (await response.json()) as { messageId?: string };
      this.logger.log(
        `Correo enviado vía Brevo ("${options.subject}"), messageId: ${data.messageId || 'N/A'}`,
      );

      return {
        success: true,
        messageId: data.messageId,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const errorMessage =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Timeout excedido (6000ms) conectando a Brevo'
            : err.message
          : String(err);

      this.logger.error(`Fallo de conexión al enviar correo con Brevo: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
