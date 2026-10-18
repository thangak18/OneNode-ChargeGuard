import {Global, Module} from '@nestjs/common';
import {APP_CONFIG} from './tokens';
import {loadLocalEnv, validateConfig} from './config';

@Global()
@Module({providers:[{provide:APP_CONFIG,useFactory:()=>{loadLocalEnv();return validateConfig(process.env);}}],exports:[APP_CONFIG]})
export class AppConfigModule {}
