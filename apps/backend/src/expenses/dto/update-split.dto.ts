import { IsBoolean } from 'class-validator';

export class UpdateSplitDto {
  @IsBoolean()
  settled!: boolean;
}
