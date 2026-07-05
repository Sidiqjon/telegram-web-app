export interface AccessTokenPayload {
  sub: string; // userId
  username: string;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  jti: string; // refresh token record id (RefreshToken.id)
}
