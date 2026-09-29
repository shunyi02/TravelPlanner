import { Module } from '@nestjs/common';
import { FieldCipherService } from './field-cipher.service';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService, FieldCipherService],
  exports: [UsersService],
})
export class UsersModule {}
