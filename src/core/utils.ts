import { HttpException, HttpStatus } from '@nestjs/common';

export class Utils {
  /**
   * Vérification de l'extension d'un document entrant pour s'assurer qu'il s'agisse d'un fichier pdf
   * @param req
   * @param file
   * @param callback
   */
  static pdfFileFilter = (req, file, callback) => {
    if (!file.originalname.match(/\.(pdf)$/)) {
      return callback(
        new HttpException(
          'Seul les fichiers en .pdf sont acceptés.',
          HttpStatus.BAD_REQUEST,
        ),
        false,
      );
    }
    return callback(null, true);
  };
}
