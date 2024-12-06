import { Allow, Permission } from '@firelancer/core';
import { Controller, Get } from '@nestjs/common';

@Controller('hello-world')
export class HelloWorldController {
  constructor() {}

  @Get()
  @Allow(Permission.Public)
  custom() {
    return 'Hello world!';
  }
}
