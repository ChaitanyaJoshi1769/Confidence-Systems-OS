import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../services/user.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access_token')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getCurrentUser(@Request() req: any) {
    return this.userService.findById(req.user.userId, req.user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List users in organization' })
  async listUsers(
    @Request() req: any,
  ) {
    return this.userService.listUsers(req.user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(
    @Param('id') userId: string,
    @Request() req: any,
  ) {
    return this.userService.findById(userId, req.user.organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new user (admin only)' })
  async createUser(
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.userService.createUser(req.user.organizationId, data, req.user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile' })
  async updateUser(
    @Param('id') userId: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.userService.updateUser(userId, req.user.organizationId, data, req.user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (admin only)' })
  async deleteUser(
    @Param('id') userId: string,
    @Request() req: any,
  ) {
    await this.userService.deleteUser(userId, req.user.organizationId, req.user.userId);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Body() data: { oldPassword: string; newPassword: string },
    @Request() req: any,
  ) {
    await this.userService.changePassword(req.user.userId, data.oldPassword, data.newPassword);
    return { message: 'Password changed successfully' };
  }
}
