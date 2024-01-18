import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as path from 'path';
import { RegleauLogger } from '../../logger/regleau.logger';

@Injectable()
export class MailService {
  private readonly _logger = new RegleauLogger('MailService');
  private readonly _mailTemplatePath = path.resolve(`./dist/mail_template`);

  constructor(private readonly _mailerService: MailerService) {}

  /**
   * Envoi d'un email selon un template
   * @param email
   * @param subject
   * @param template
   * @param context
   */
  sendEmail(
    email: string,
    subject: string,
    template: string,
    context?: any,
  ): Promise<any> {
    return this._mailerService
      .sendMail({
        to: email,
        from: `${process.env.MAIL_USER}`,
        subject: `Règl'Eau - ${subject}`,
        template: `./${template}`,
        context: context,
      })
      .then((info) => {
        this._logger.log(
          `MAIL SEND TO: ${email} WITH SUBJECT: ${subject} WITH TEMPLATE: ${template} AND CONTEXT: ${JSON.stringify(
            context,
          )}`,
        );
      })
      .catch((error) => {
        this._logger.error(
          `FAIL - MAIL SEND TO: ${email} WITH SUBJECT: ${subject} WITH TEMPLATE: ${template} AND CONTEXT: ${JSON.stringify(
            context,
          )}`,
          error,
        );
        throw new HttpException(
          "Une erreur est survenue dans l'envoi du mail.",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
  }
}
