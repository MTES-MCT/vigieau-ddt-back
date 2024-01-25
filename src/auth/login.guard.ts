import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoginGuard extends AuthGuard('oidc') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    try {
      const result = (await super.canActivate(context)) as boolean;
      const request = context.switchToHttp().getRequest();
      await super.logIn(request);
      return result;
    } catch (e) {
      const response = context.switchToHttp().getResponse();
      response.redirect(
        this.configService.get('WEBSITE_URL') + '?error=unauthorized',
      );
    }
  }
}
