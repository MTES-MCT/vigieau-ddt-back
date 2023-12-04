import { IsNumber, IsString } from 'class-validator';

export class ZoneAlerteDto {
  @IsNumber()
  id: number;

  @IsString()
  code: string;

  @IsString()
  type: string;

  @IsString()
  nom: string;

  @IsNumber()
  surface: number;
}
