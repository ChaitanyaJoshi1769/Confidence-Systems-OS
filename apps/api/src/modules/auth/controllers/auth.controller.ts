import { Controller, Post, Body, UseGuards, Request, Response, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { User } from '../entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new organization and user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      properties: {
        user: { type: 'object' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  async signup(
    @Body() signupData: any,
    @Request() req: any,
    @Response() res: any,
  ) {
    const result = await this.authService.signup(signupData);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(HttpStatus.CREATED).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      properties: {
        user: { type: 'object' },
        accessToken: { type: 'string' },
      },
    },
  })
  async login(
    @Body() credentials: { email: string; password: string },
    @Request() req: any,
    @Response() res: any,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const result = await this.authService.login(credentials, ipAddress, userAgent);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed',
    schema: {
      properties: {
        accessToken: { type: 'string' },
      },
    },
  })
  async refresh(
    @Request() req: any,
    @Response() res: any,
  ) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Refresh token not found' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const result = await this.authService.refreshToken(refreshToken, ipAddress);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken: result.accessToken,
    });
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Request() req: any, @Response() res: any) {
    // TODO: Implement session-based logout
    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out successfully' });
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user',
    type: User,
  })
  async getCurrentUser(@Request() req: any) {
    return req.user;
  }
}
