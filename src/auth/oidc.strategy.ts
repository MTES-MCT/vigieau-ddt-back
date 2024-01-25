import { UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  Client,
  UserinfoResponse,
  TokenSet,
  Issuer,
  generators,
  errors,
} from 'openid-client';
import { UserService } from '../user/user.service';
import random = generators.random;

export const buildOpenIdClient = async () => {
  const TrustIssuer = await Issuer.discover(
    `${process.env.OAUTH2_CLIENT_PROVIDER_OIDC_ISSUER}/.well-known/openid-configuration`,
  );
  const client = new TrustIssuer.Client({
    client_id: process.env.OAUTH2_CLIENT_REGISTRATION_LOGIN_CLIENT_ID,
    client_secret: process.env.OAUTH2_CLIENT_REGISTRATION_LOGIN_CLIENT_SECRET,
    acr_values: TrustIssuer.acr_values_supported,
    response_type: 'code',
  });
  return client;
};

export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  client: Client;

  constructor(
    private readonly userService: UserService,
    client: Client,
  ) {
    super({
      client: client,
      params: {
        redirect_uri: process.env.OAUTH2_CLIENT_REGISTRATION_LOGIN_REDIRECT_URI,
        scope: process.env.OAUTH2_CLIENT_REGISTRATION_LOGIN_SCOPE,
        acr_values: client.acr_values,
      },
      passReqToCallback: true,
      usePKCE: false,
    });
    console.log('plep', client);

    this.client = client;
  }

  authenticate(req, options: any = {}) {
    options.nonce = random();
    super.authenticate(req, options);
  }

  async validate(tokenset: TokenSet): Promise<any> {
    console.log('VALIDATE', tokenset);
    const userinfo: UserinfoResponse = await this.client.userinfo(tokenset);
    const userInDb = await this.userService.findOne(userinfo?.email);

    if (!userInDb) {
      console.log('NOT USE IN DB');
      throw new UnauthorizedException();
    }

    try {
      const id_token = tokenset.id_token;
      const access_token = tokenset.access_token;
      const refresh_token = tokenset.refresh_token;
      const user = {
        id_token,
        access_token,
        refresh_token,
        userinfo,
      };
      return user;
    } catch (err) {
      console.log('ERROR', err);
      throw new UnauthorizedException();
    }
  }
}
