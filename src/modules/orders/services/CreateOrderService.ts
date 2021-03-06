import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exists');
    }

    const findAllProducts = await this.productsRepository.findAllById(products);

    const orderProducts = products.map(product => {
      const stockProduct = findAllProducts.find(
        foundProduct => foundProduct.id === product.id,
      );

      if (!stockProduct) {
        throw new AppError('Product not found!');
      }

      if (
        stockProduct.quantity < product.quantity ||
        stockProduct.quantity === 0
      ) {
        throw new AppError('Product Out of stock');
      }

      return {
        product_id: product.id,
        price: stockProduct.price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        findAllProducts.filter(p => product.product_id === p.id)[0].quantity -
        product.quantity,
      name: findAllProducts.filter(p => product.product_id === p.id)[0].name,
      price: findAllProducts.filter(p => product.product_id === p.id)[0].price,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
