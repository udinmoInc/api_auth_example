import { Request, Response } from 'express';
import AuthService from './auth.service';
import { AuthDto } from './auth.dto';
import ApiResponse from '@/utils/response';
import config from '@/config';
import { ApiError } from '@/utils/errors';

export class AuthController {
  private service = new AuthService();

  // Set HTTP-Only, SameSite cookie for the refresh token
  private setRefreshTokenCookie(res: Response, token: string) {
    const isProd = config.env === 'production';
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days (matches refresh token expiry)

    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: config.security.cookiesSecure || isProd,
      sameSite: 'strict',
      maxAge,
      path: '/',
    });
  }

  // Clear HTTP-Only cookie during logout
  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.security.cookiesSecure || config.env === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  public register = async (req: Request, res: Response) => {
    const user = await this.service.register(req.body);
    const userDto = AuthDto.toUserDto(user);
    
    return ApiResponse.success(
      res,
      201,
      'Registration successful. Verification email sent.',
      { user: userDto }
    );
  };

  public login = async (req: Request, res: Response) => {
    const device = req.deviceMetadata || {};
    const result = await this.service.login(req.body, device);
    
    this.setRefreshTokenCookie(res, result.refreshToken);

    const userDto = AuthDto.toUserDto(result.user);

    return ApiResponse.success(res, 200, 'Login successful.', {
      user: userDto,
      accessToken: result.accessToken,
    });
  };

  public refresh = async (req: Request, res: Response) => {
    const oldRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!oldRefreshToken) {
      throw new ApiError(401, 'Refresh token is missing.');
    }

    const device = req.deviceMetadata || {};
    const result = await this.service.rotateTokens(oldRefreshToken, device);

    this.setRefreshTokenCookie(res, result.refreshToken);

    return ApiResponse.success(res, 200, 'Token refreshed successfully.', {
      accessToken: result.accessToken,
    });
  };

  public logout = async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      await this.service.logout(refreshToken);
    }

    this.clearRefreshTokenCookie(res);

    return ApiResponse.success(res, 200, 'Logged out successfully.');
  };

  public verifyEmail = async (req: Request, res: Response) => {
    const token = req.query.token;
    
    if (typeof token !== 'string') {
      throw new ApiError(400, 'Verification token must be a string.');
    }

    const user = await this.service.verifyEmail(token);
    const userDto = AuthDto.toUserDto(user);

    return ApiResponse.success(res, 200, 'Email verified successfully.', {
      user: userDto,
    });
  };

  public forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    await this.service.forgotPassword(email);

    // Standard security: respond identically whether email exists or not
    return ApiResponse.success(
      res,
      200,
      'If the email is registered, a password reset link has been sent.'
    );
  };

  public resetPassword = async (req: Request, res: Response) => {
    await this.service.resetPassword(req.body);

    return ApiResponse.success(
      res,
      200,
      'Password updated successfully. All other active sessions have been logged out.'
    );
  };

  public getSessions = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const currentSessionId = req.user!.sessionId;

    const sessions = await this.service.getActiveSessions(userId, currentSessionId);
    return ApiResponse.success(res, 200, 'Active sessions fetched.', { sessions });
  };

  public revokeSession = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ApiError(400, 'Session ID is required.');
    }

    await this.service.revokeSession(userId, sessionId as string);
    return ApiResponse.success(res, 200, 'Session revoked successfully.');
  };
}

export default AuthController;
