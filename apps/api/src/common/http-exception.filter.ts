import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
@Catch()
export class SanitizedExceptionFilter implements ExceptionFilter {
  catch(exception:unknown,host:ArgumentsHost) {
    const response=host.switchToHttp().getResponse<Response>();
    const request=host.switchToHttp().getRequest<Request>();
    const http=exception instanceof HttpException;
    const status=http?exception.getStatus():HttpStatus.INTERNAL_SERVER_ERROR;
    const detail=http?exception.getResponse():undefined;
    const message=typeof detail==='object' && detail!==null && 'message' in detail ? (detail as {message:unknown}).message : http ? exception.message : 'Internal server error';
    const fields=typeof detail==='object' && detail!==null && 'fields' in detail ? (detail as {fields:unknown}).fields : undefined;
    response.status(status).json({statusCode:status,error:status>=500?'Server Error':'Request Error',message, ...(fields ? {fields}:{}),path:request.path,timestamp:new Date().toISOString()});
  }
}
