import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LoginGuard extends AuthGuard('oidc') {
  async canActivate(context: ExecutionContext) {
    console.log('plep 1');
    const result = (await super.canActivate(context)) as boolean;
    console.log('plep 2');
    const request = context.switchToHttp().getRequest();
    console.log('plep 3');
    await super.logIn(request);
    console.log('plep 4');
    return result;
  }
}
