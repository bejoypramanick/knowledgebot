import json
import boto3
import os
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime

# Pydantic models
class OrderLookupRequest(BaseModel):
    order_id: str = Field(..., description="Order ID to look up")
    customer_email: Optional[str] = Field(None, description="Customer email for verification")

class OrderStatus(BaseModel):
    order_id: str = Field(..., description="Order ID")
    status: str = Field(..., description="Order status")
    customer_name: str = Field(..., description="Customer name")
    customer_email: str = Field(..., description="Customer email")
    order_date: str = Field(..., description="Order date")
    total_amount: float = Field(..., description="Total order amount")
    items: list = Field(default=[], description="Order items")
    tracking_number: Optional[str] = Field(None, description="Tracking number if shipped")
    estimated_delivery: Optional[str] = Field(None, description="Estimated delivery date")
    last_updated: str = Field(..., description="Last status update timestamp")

class OrderHandler:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.orders_table = self.dynamodb.Table('chatbot-orders')

    def lookup_order(self, order_id: str, customer_email: Optional[str] = None) -> Optional[OrderStatus]:
        """Look up order status from database"""
        try:
            response = self.orders_table.get_item(
                Key={'order_id': order_id}
            )
            
            if 'Item' not in response:
                return None
            
            order_data = response['Item']
            
            # Verify customer email if provided
            if customer_email and order_data.get('customer_email') != customer_email:
                return None
            
            return OrderStatus(
                order_id=order_data['order_id'],
                status=order_data['status'],
                customer_name=order_data['customer_name'],
                customer_email=order_data['customer_email'],
                order_date=order_data['order_date'],
                total_amount=float(order_data['total_amount']),
                items=order_data.get('items', []),
                tracking_number=order_data.get('tracking_number'),
                estimated_delivery=order_data.get('estimated_delivery'),
                last_updated=order_data['last_updated']
            )
            
        except Exception as e:
            print(f"Error looking up order: {e}")
            return None

    def create_sample_orders(self):
        """Create sample orders for testing"""
        sample_orders = [
            {
                'order_id': 'ORD-001',
                'status': 'shipped',
                'customer_name': 'John Doe',
                'customer_email': 'john.doe@example.com',
                'order_date': '2024-01-15',
                'total_amount': 299.99,
                'items': [
                    {'name': 'Laptop', 'quantity': 1, 'price': 299.99}
                ],
                'tracking_number': 'TRK123456789',
                'estimated_delivery': '2024-01-20',
                'last_updated': '2024-01-16T10:30:00Z'
            },
            {
                'order_id': 'ORD-002',
                'status': 'processing',
                'customer_name': 'Jane Smith',
                'customer_email': 'jane.smith@example.com',
                'order_date': '2024-01-18',
                'total_amount': 149.50,
                'items': [
                    {'name': 'Mouse', 'quantity': 2, 'price': 74.75}
                ],
                'estimated_delivery': '2024-01-25',
                'last_updated': '2024-01-18T14:20:00Z'
            },
            {
                'order_id': 'ORD-003',
                'status': 'delivered',
                'customer_name': 'Bob Johnson',
                'customer_email': 'bob.johnson@example.com',
                'order_date': '2024-01-10',
                'total_amount': 89.99,
                'items': [
                    {'name': 'Keyboard', 'quantity': 1, 'price': 89.99}
                ],
                'tracking_number': 'TRK987654321',
                'estimated_delivery': '2024-01-15',
                'last_updated': '2024-01-15T16:45:00Z'
            }
        ]
        
        try:
            for order in sample_orders:
                self.orders_table.put_item(Item=order)
            print("Sample orders created successfully")
        except Exception as e:
            print(f"Error creating sample orders: {e}")

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for order lookup requests"""
    try:
        # Parse the request
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        http_method = event.get('httpMethod', 'POST')
        path = event.get('path', '')
        
        order_handler = OrderHandler()
        
        if http_method == 'POST' and 'lookup' in path:
            # Handle order lookup
            lookup_request = OrderLookupRequest(**body)
            
            # Look up order
            order_status = order_handler.lookup_order(
                lookup_request.order_id,
                lookup_request.customer_email
            )
            
            if order_status:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps(order_status.dict())
                }
            else:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Order not found',
                        'message': f'No order found with ID: {lookup_request.order_id}'
                    })
                }
        
        elif http_method == 'POST' and 'init' in path:
            # Initialize sample data
            order_handler.create_sample_orders()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'message': 'Sample orders initialized successfully'
                })
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Invalid request method or path'
                })
            }
            
    except Exception as e:
        print(f"Error in order handler: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }

