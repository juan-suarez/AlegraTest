import { IncomingMessage, ServerResponse } from 'http';
import { CreateOrderUseCase } from '../use-cases';
import { CreateOrderInput } from '../use-cases/types';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class OrderController {
  constructor(private createOrderUseCase: CreateOrderUseCase) {}

  async handleCreateOrder(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // Parsear el body
      const body = await this.parseBody(req);

      // Validar estructura del request
      const validation = this.validateCreateOrderInput(body);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Validation failed',
          details: validation.errors
        }));
        return;
      }

      // Invocar el use-case
      const input: CreateOrderInput = {
        orderId: body.orderId,
        totalDishes: body.totalDishes
      };

      const result = await this.createOrderUseCase.execute(input);

      // Retornar respuesta exitosa
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: result
      }));
    } catch (error) {
      console.error('Error en CreateOrder:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  private validateCreateOrderInput(data: any): ValidationResult {
    const errors: string[] = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validar que existe orderId
    if (!data.hasOwnProperty('orderId')) {
      errors.push('Field "orderId" is required');
    } else if (typeof data.orderId !== 'string') {
      errors.push('Field "orderId" must be a string');
    } else if (data.orderId.trim() === '') {
      errors.push('Field "orderId" cannot be empty');
    } else if (!uuidRegex.test(data.orderId)) {
      errors.push('Field "orderId" must be a valid UUID');
    }

    // Validar que existe totalDishes
    if (!data.hasOwnProperty('totalDishes')) {
      errors.push('Field "totalDishes" is required');
    } else if (typeof data.totalDishes !== 'number') {
      errors.push('Field "totalDishes" must be a number');
    } else if (data.totalDishes <= 0) {
      errors.push('Field "totalDishes" must be greater than 0');
    } else if (!Number.isInteger(data.totalDishes)) {
      errors.push('Field "totalDishes" must be an integer');
    }

    // Validar que no hay campos adicionales
    const allowedFields = ['orderId', 'totalDishes'];
    const extraFields = Object.keys(data).filter(key => !allowedFields.includes(key));
    if (extraFields.length > 0) {
      errors.push(`Unexpected fields: ${extraFields.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = '';

      req.on('data', (chunk) => {
        data += chunk.toString();
      });

      req.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve(parsed);
        } catch (error) {
          reject(new Error('Invalid JSON in request body'));
        }
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }
}
