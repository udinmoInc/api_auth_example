import { Request, Response } from 'express';
import AuthService from './auth.service';
import { AuthDto } from './auth.dto';
import ApiResponse from '@/utils/response';
import config from '@/config';
import { COOKIE_NAMES, ERROR_CODES } from '@/constants';
import { ApiError } from '@/utils/errors';

export class AuthController {
  private service = new AuthService();

  // Helper to set secure refresh token cookie
  private setRefreshTokenCookie(res: Response, token: string): void {
    const isProd = config.env === 'production';
    const maxAge = config.jwt.refreshExpiryMs;

    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, token, {
      httpOnly: true,
      secure: config.security.cookiesSecure || isProd,
      sameSite: 'strict',
      maxAge,
      path: '/',
    });
  }

  // Clear cookie upon logout
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, {
      httpOnly: true,
      secure: config.security.cookiesSecure || config.env === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  public register = async (req: Request, res: Response): Promise<Response> => {
    const user = await this.service.register(req.body);
    const userDto = AuthDto.toUserDto(user);
    
    return ApiResponse.success(
      res,
      201,
      'Registration successful. Verification email sent.',
      { user: userDto }
    );
  };

  public login = async (req: Request, res: Response): Promise<Response> => {
    const device = req.deviceMetadata || {};
    const result = await this.service.login(req.body, device);
    
    this.setRefreshTokenCookie(res, result.refreshToken);

    const userDto = AuthDto.toUserDto(result.user);

    return ApiResponse.success(res, 200, 'Login successful.', {
      user: userDto,
      accessToken: result.accessToken,
    });
  };

  public refresh = async (req: Request, res: Response): Promise<Response> => {
    const oldRefreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] || req.body?.[COOKIE_NAMES.REFRESH_TOKEN];

    if (!oldRefreshToken) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, 'Refresh token is missing.');
    }

    const device = req.deviceMetadata || {};
    const result = await this.service.rotateTokens(oldRefreshToken, device);

    this.setRefreshTokenCookie(res, result.refreshToken);

    return ApiResponse.success(res, 200, 'Token refreshed successfully.', {
      accessToken: result.accessToken,
    });
  };

  public logout = async (req: Request, res: Response): Promise<Response> => {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] || req.body?.[COOKIE_NAMES.REFRESH_TOKEN];

    if (refreshToken) {
      await this.service.logout(refreshToken);
    }

    this.clearRefreshTokenCookie(res);

    return ApiResponse.success(res, 200, 'Logged out successfully.');
  };

  public verifyEmail = async (req: Request, res: Response): Promise<Response> => {
    const token = req.query.token;
    
    if (typeof token !== 'string') {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, 'Verification token must be a string.');
    }

    const user = await this.service.verifyEmail(token);
    const userDto = AuthDto.toUserDto(user);

    return ApiResponse.success(res, 200, 'Email verified successfully.', {
      user: userDto,
    });
  };

  public forgotPassword = async (req: Request, res: Response): Promise<Response> => {
    const { email } = req.body;
    await this.service.forgotPassword(email);

    // Uniform response to prevent email enumeration
    return ApiResponse.success(
      res,
      200,
      'If the email is registered, a password reset link has been sent.'
    );
  };

  public resetPassword = async (req: Request, res: Response): Promise<Response> => {
    await this.service.resetPassword(req.body);

    return ApiResponse.success(
      res,
      200,
      'Password updated successfully. All other active sessions have been logged out.'
    );
  };

  public getSessions = async (req: Request, res: Response): Promise<Response> => {
    const userId = req.user!.userId;
    const currentSessionId = req.user!.sessionId;

    const sessions = await this.service.getActiveSessions(userId, currentSessionId);
    return ApiResponse.success(res, 200, 'Active sessions fetched.', { sessions });
  };

  public revokeSession = async (req: Request, res: Response): Promise<Response> => {
    const userId = req.user!.userId;
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, 'Session ID is required.');
    }

    await this.service.revokeSession(userId, sessionId as string);
    return ApiResponse.success(res, 200, 'Session revoked successfully.');
  };
}

export default AuthController;
