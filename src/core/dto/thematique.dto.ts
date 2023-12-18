import { IsNumber, IsString } from 'class-validator';

export class ThematiqueDto {
  @IsNumber()
  id: number;

  @IsString()
  nom: string;
}
